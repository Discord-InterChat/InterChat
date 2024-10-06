import { emojis } from '#main/config/Constants.js';
import { createConnection, getHubConnections } from '#main/utils/ConnectedListUtils.js';
import db from '#main/utils/Db.js';
import { sendToHub } from '#main/utils/hub/utils.js';
import { logJoinToHub } from '#main/utils/HubLogger/JoinLeave.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { showOnboarding } from '#main/utils/network/onboarding.js';
import { getOrCreateWebhook } from '#main/utils/Utils.js';
import type { Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  Snowflake,
} from 'discord.js';
import HubCommand from './index.js';
import ServerInfractionManager from '#main/modules/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/modules/InfractionManager/UserInfractionManager.js';
import BlacklistManager from '#main/modules/BlacklistManager.js';
import { check } from '#main/utils/ProfanityUtils.js';

export default class JoinSubCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    const checksPassed = await this.runChecks(interaction, channel, locale);
    if (!checksPassed) return;

    const hub = await this.fetchHub(interaction, locale);
    if (!hub) {
      await interaction.reply({
        content: t('hub.notFound', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    if (
      (await this.isAlreadyInHub(interaction, channel.id, locale)) ||
      (await this.isBlacklisted(interaction, hub, locale))
    ) return;

    const onboardingSuccess = await this.processOnboarding(interaction, { hub, channel, locale });
    if (!onboardingSuccess) return;

    const webhook = await this.createWebhook(interaction, channel, locale);
    if (!webhook) return;

    // finally make the connection
    await createConnection({
      serverId: channel.guildId,
      channelId: channel.id,
      parentId: channel.isThread() ? channel.parentId : undefined,
      webhookURL: webhook.url,
      hub: { connect: { id: hub.id } },
      connected: true,
      compact: true,
      profFilter: true,
    });

    await interaction.editReply({
      content: t('hub.join.success', locale, { channel: `${channel}`, hub: hub.name }),
      embeds: [],
      components: [],
    });

    const totalConnections =
      (await getHubConnections(hub.id))?.reduce((total, c) => total + (c.connected ? 1 : 0), 0) ??
      0;

    // announce
    await sendToHub(hub.id, {
      username: `InterChat | ${hub.name}`,
      content: stripIndents`
      A new server has joined the hub! ${emojis.clipart}

      **Server Name:** __${interaction.guild.name}__
      **Member Count:** __${interaction.guild.memberCount}__

      We now have **${totalConnections}** servers with us!
    `,
    });

    // send log
    await logJoinToHub(hub.id, interaction.guild, { totalConnections, hubName: hub.name });
  }

  private async runChecks(
    interaction: ChatInputCommandInteraction<'cached'>,
    channel: GuildTextBasedChannel,
    locale: supportedLocaleCodes,
  ) {
    if (!channel.permissionsFor(interaction.member).has('ManageMessages')) {
      await this.replyEmbed(
        interaction,
        t('errors.missingPermissions', locale, {
          permissions: 'Manage Messages',
          emoji: emojis.no,
        }),
        { ephemeral: true },
      );
      return false;
    }

    const { hasSlurs, hasProfanity } = check(interaction.guild.name);
    if (hasSlurs || hasProfanity) {
      await this.replyEmbed(
        interaction,
        `${emojis.no} Your server name contains inappropriate words. Please change it before joining the hub.`,
        { ephemeral: true },
      );
      return false;
    }

    return true;
  }

  private async fetchHub(interaction: ChatInputCommandInteraction, locale: supportedLocaleCodes) {
    const hubName = interaction.options.getString('hub') ?? 'InterChat Central';
    const invite = interaction.options.getString('invite');

    // bunch of checks to see if hub exists / invite is valid
    if (invite) {
      const fetchedInvite = await db.hubInvite.findFirst({
        where: { code: invite },
        include: { hub: true },
      });

      if (!fetchedInvite) {
        await this.replyEmbed(
          interaction,
          t('hub.invite.revoke.invalidCode', locale, { emoji: emojis.no }),
          { ephemeral: true },
        );
        return null;
      }

      return fetchedInvite.hub;
    }

    return await db.hub.findFirst({ where: { name: hubName, private: false } });
  }

  private async isAlreadyInHub(
    interaction: ChatInputCommandInteraction,
    channelId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const channelInHub = await db.connectedList.findFirst({ where: { channelId } });
    if (channelInHub) {
      const otherHub = await db.hub.findFirst({ where: { id: channelInHub.hubId } });
      await this.replyEmbed(
        interaction,
        t('hub.alreadyJoined', locale, {
          channel: `<#${channelId}>`,
          hub: `${otherHub?.name}`,
          emoji: emojis.no,
        }),
        { ephemeral: true },
      );
      return true;
    }

    return false;
  }

  private async isBlacklisted(
    interaction: ChatInputCommandInteraction<'cached'>,
    hub: Hub,
    locale: supportedLocaleCodes,
  ) {
    const userBlManager = new BlacklistManager(new UserInfractionManager(interaction.user.id));
    const serverBlManager = new BlacklistManager(new ServerInfractionManager(interaction.guildId));

    const userBlacklist = await userBlManager.fetchBlacklist(hub.id);
    const serverBlacklist = await serverBlManager.fetchBlacklist(hub.id);

    if (userBlacklist || serverBlacklist) {
      await interaction.reply({
        content: t('errors.blacklisted', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return true;
    }

    return false;
  }

  private async processOnboarding(
    interaction: ChatInputCommandInteraction,
    opts: { hub: Hub; channel: GuildTextBasedChannel; locale: supportedLocaleCodes },
  ): Promise<boolean> {
    // display onboarding message, also prevents user from joining twice
    const onboardingCompleted = await showOnboarding(interaction, opts.hub.name, opts.channel.id);
    // if user cancels onboarding or it times out
    if (!onboardingCompleted) {
      await interaction.deleteReply().catch(() => null);
      return false;
    }
    else if (onboardingCompleted === 'in-progress') {
      await this.replyEmbed(
        interaction,
        t('network.onboarding.inProgress', opts.locale, {
          channel: `${opts.channel}`,
          emoji: emojis.dnd_anim,
        }),
        { ephemeral: true },
      );
      return false;
    }

    return true;
  }

  private async createWebhook(
    interaction: ChatInputCommandInteraction,
    channel: GuildTextBasedChannel,
    locale: supportedLocaleCodes,
  ) {
    const webhook = await getOrCreateWebhook(channel);
    if (!webhook) {
      await this.replyEmbed(
        interaction,
        t('errors.botMissingPermissions', locale, {
          permissions: 'Manage Webhooks',
          emoji: emojis.no,
        }),
        { components: [], edit: true },
      );
      return null;
    }

    return webhook;
  }
}
