import { showOnboarding } from '#main/utils/network/onboarding.js';
import { createConnection, getHubConnections } from '#main/utils/ConnectedListUtils.js';
import { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { logJoinToHub } from '#main/utils/HubLogger/JoinLeave.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { getOrCreateWebhook, simpleEmbed } from '#main/utils/Utils.js';
import { hubs } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  NewsChannel,
  Snowflake,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import Hub from './index.js';
import { sendToHub } from '#main/utils/hub/utils.js';

export default class JoinSubCommand extends Hub {
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
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    if (await this.isAlreadyInHub(interaction, hub, channel.guildId, locale)) return;
    if (await this.isBlacklisted(interaction, hub, locale)) return;

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
      content: t({ phrase: 'hub.join.success', locale }, { channel: `${channel}`, hub: hub.name }),
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
        t(
          { phrase: 'errors.missingPermissions', locale },
          { permissions: 'Manage Messages', emoji: emojis.no },
        ),
        { ephemeral: true },
      );
      return false;
    }

    const channelInHub = await db.connectedList.findFirst({ where: { channelId: channel.id } });
    if (channelInHub) {
      const otherHub = await db.hubs.findFirst({ where: { id: channelInHub.hubId } });
      await this.replyEmbed(
        interaction,
        t(
          { phrase: 'hub.alreadyJoined', locale },
          { channel: `${channel.toString()}`, hub: `${otherHub?.name}`, emoji: emojis.no },
        ),
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
      const fetchedInvite = await db.hubInvites.findFirst({
        where: { code: invite },
        include: { hub: true },
      });

      if (!fetchedInvite) {
        await this.replyEmbed(
          interaction,
          t({ phrase: 'hub.invite.revoke.invalidCode', locale }, { emoji: emojis.no }),
          { ephemeral: true },
        );
        return null;
      }

      return fetchedInvite.hub;
    }

    return await db.hubs.findFirst({ where: { name: hubName, private: false } });
  }

  private async isAlreadyInHub(
    interaction: ChatInputCommandInteraction,
    hub: hubs,
    serverId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const alreadyInHub = await db.connectedList.findFirst({
      where: { hubId: hub.id, serverId },
    });

    if (alreadyInHub) {
      await this.replyEmbed(
        interaction,
        t(
          { phrase: 'hub.alreadyJoined', locale },
          { hub: hub.name, channel: `<#${alreadyInHub.channelId}>`, emoji: emojis.no },
        ),
        { ephemeral: true },
      );
      return true;
    }

    return false;
  }

  private async isBlacklisted(
    interaction: ChatInputCommandInteraction<'cached'>,
    hub: hubs,
    locale: supportedLocaleCodes,
  ) {
    const { userManager, serverBlacklists } = interaction.client;

    const userBlacklisted = await userManager.fetchBlacklist(hub.id, interaction.user.id);
    const serverBlacklisted = await serverBlacklists.fetchBlacklist(hub.id, interaction.guildId);

    if (userBlacklisted || serverBlacklisted) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.blacklisted', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return true;
    }

    return false;
  }

  private async processOnboarding(
    interaction: ChatInputCommandInteraction,
    opts: { hub: hubs; channel: GuildTextBasedChannel; locale: supportedLocaleCodes },
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
        t(
          { phrase: 'network.onboarding.inProgress', locale: opts.locale },
          { channel: `${opts.channel}`, emoji: emojis.dnd_anim },
        ),
        { ephemeral: true },
      );
      return false;
    }

    return true;
  }

  private async createWebhook(
    interaction: ChatInputCommandInteraction,
    channel: NewsChannel | TextChannel | ThreadChannel,
    locale: supportedLocaleCodes,
  ) {
    const webhook = await getOrCreateWebhook(channel);
    if (!webhook) {
      await this.replyEmbed(
        interaction,
        t(
          { phrase: 'errors.botMissingPermissions', locale },
          { permissions: 'Manage Webhooks', emoji: emojis.no },
        ),
        { components: [], edit: true },
      );
      return null;
    }

    return webhook;
  }
}
