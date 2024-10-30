import { emojis } from '#main/config/Constants.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { TranslationKeys } from '#main/types/locale.js';
import { createConnection, getHubConnections } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { sendToHub } from '#utils/hub/utils.js';
import { logJoinToHub } from '#utils/HubLogger/JoinLeave.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { showOnboarding } from '#utils/network/onboarding.js';
import { check } from '#utils/ProfanityUtils.js';
import { getOrCreateWebhook } from '#utils/Utils.js';
import { Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  MessageComponentInteraction,
  Snowflake,
} from 'discord.js';

export class HubJoinService {
  private interaction:
    | ChatInputCommandInteraction<'cached'>
    | MessageComponentInteraction<'cached'>;
  private locale: supportedLocaleCodes;

  constructor(
    interaction: ChatInputCommandInteraction<'cached'> | MessageComponentInteraction<'cached'>,
    locale: supportedLocaleCodes,
  ) {
    this.interaction = interaction;
    this.locale = locale;
  }

  async joinRandomHub(channel: GuildTextBasedChannel) {
    const hub = await db.hub.findMany({
      where: { private: false },
      orderBy: { connections: { _count: 'asc' } },
      take: 10,
    });

    const randomHub = hub[Math.floor(Math.random() * hub.length)];
    return await this.joinHub(channel, randomHub.name);
  }

  async joinHub(channel: GuildTextBasedChannel, hubInviteOrName: string | undefined) {
    const checksPassed = await this.runChecks(channel);
    if (!checksPassed) return false;

    const hub = await this.fetchHub(hubInviteOrName);
    if (!hub) {
      await this.interaction.reply({
        content: t('hub.notFound', this.locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return false;
    }

    if ((await this.isAlreadyInHub(channel.id)) || (await this.isBlacklisted(hub))) return false;

    const onboardingSuccess = await this.processOnboarding(hub, channel);
    if (!onboardingSuccess) return false;

    const webhook = await this.createWebhook(channel);
    if (!webhook) return false;

    // Create the connection
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

    await this.sendSuccessMessages(hub, channel);
    return true;
  }

  private async runChecks(channel: GuildTextBasedChannel) {
    if (!channel.permissionsFor(this.interaction.member).has('ManageMessages')) {
      await this.replyError('errors.missingPermissions', {
        permissions: 'Manage Messages',
        emoji: emojis.no,
      });
      return false;
    }

    const { hasSlurs, hasProfanity } = check(this.interaction.guild.name);
    if (hasSlurs || hasProfanity) {
      await this.replyError('errors.serverNameInappropriate', { emoji: emojis.no });
      return false;
    }

    return true;
  }

  private async fetchHub(hubNameOrInvite?: string) {
    const hubName = hubNameOrInvite ?? 'InterChat Central';

    // Check if it's an invite code
    if (hubNameOrInvite) {
      const fetchedInvite = await db.hubInvite.findFirst({
        where: { code: hubNameOrInvite },
        include: { hub: true },
      });

      if (fetchedInvite) return fetchedInvite.hub;
    }

    // Otherwise search by name
    return await db.hub.findFirst({
      where: { name: hubName, private: false },
    });
  }

  private async isAlreadyInHub(channelId: Snowflake) {
    const channelInHub = await db.connectedList.findFirst({ where: { channelId } });
    if (channelInHub) {
      const otherHub = await db.hub.findFirst({ where: { id: channelInHub.hubId } });
      await this.replyError('hub.alreadyJoined', {
        channel: `<#${channelId}>`,
        hub: `${otherHub?.name}`,
        emoji: emojis.no,
      });
      return true;
    }
    return false;
  }

  private async isBlacklisted(hub: Hub) {
    const userBlManager = new BlacklistManager(new UserInfractionManager(this.interaction.user.id));
    const serverBlManager = new BlacklistManager(
      new ServerInfractionManager(this.interaction.guildId),
    );

    const userBlacklist = await userBlManager.fetchBlacklist(hub.id);
    const serverBlacklist = await serverBlManager.fetchBlacklist(hub.id);

    if (userBlacklist || serverBlacklist) {
      await this.replyError('errors.blacklisted', { emoji: emojis.no, hub: hub.name });
      return true;
    }

    return false;
  }

  private async processOnboarding(hub: Hub, channel: GuildTextBasedChannel) {
    const onboardingCompleted = await showOnboarding(this.interaction, hub.name, channel.id);

    if (!onboardingCompleted) {
      await this.interaction.deleteReply().catch(() => null);
      return false;
    }
    else if (onboardingCompleted === 'in-progress') {
      await this.replyError('network.onboarding.inProgress', {
        channel: `${channel}`,
        emoji: emojis.dnd_anim,
      });
      return false;
    }

    return true;
  }

  private async createWebhook(channel: GuildTextBasedChannel) {
    const webhook = await getOrCreateWebhook(channel);
    if (!webhook) {
      await this.replyError('errors.botMissingPermissions', {
        permissions: 'Manage Webhooks',
        emoji: emojis.no,
      });
      return null;
    }
    return webhook;
  }

  private async sendSuccessMessages(hub: Hub, channel: GuildTextBasedChannel) {
    await this.interaction.editReply({
      content: t('hub.join.success', this.locale, {
        channel: `${channel}`,
        hub: hub.name,
      }),
      embeds: [],
      components: [],
    });

    const totalConnections =
      (await getHubConnections(hub.id))?.reduce((total, c) => total + (c.connected ? 1 : 0), 0) ??
      0;

    // Announce to hub
    await sendToHub(hub.id, {
      username: `InterChat | ${hub.name}`,
      content: stripIndents`
        A new server has joined the hub! ${emojis.clipart}

        **Server Name:** __${this.interaction.guild.name}__
        **Member Count:** __${this.interaction.guild.memberCount}__

        We now have **${totalConnections}** servers with us!
      `,
    });

    // Send log
    await logJoinToHub(hub.id, this.interaction.guild, {
      totalConnections,
      hubName: hub.name,
    });
  }

  private async replyError<K extends keyof TranslationKeys>(
    key: K,
    options?: { [key in TranslationKeys[K]]: string },
  ) {
    const content = t(key, this.locale, options);
    await this.interaction.reply({
      content,
      ephemeral: true,
    });
  }
}
