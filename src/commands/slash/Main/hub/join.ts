import { ChannelType, ChatInputCommandInteraction } from 'discord.js';
import { emojis } from '../../../../utils/Constants.js';
import Hub from './index.js';
import db from '../../../../utils/Db.js';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import { hubs } from '@prisma/client';
import { simpleEmbed, getOrCreateWebhook, sendToHub } from '../../../../utils/Utils.js';
import { showOnboarding } from '../../../../scripts/network/onboarding.js';
import { stripIndents } from 'common-tags';
import { t } from '../../../../utils/Locale.js';
import { logServerJoin } from '../../../../utils/HubLogger/JoinLeave.js';
import { connectChannel } from '../../../../utils/ConnectedList.js';

export default class JoinSubCommand extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    if (!interaction.inCachedGuild()) return;

    const locale = interaction.user.locale;

    // FIXME: Change later
    const hubName = interaction.options.getString('hub') ?? 'InterChat Central';
    const invite = interaction.options.getString('invite');
    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);

    if (!channel.permissionsFor(interaction.member).has('ManageMessages')) {
      return await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.missingPermissions', locale },
              { permissions: 'Manage Messages', emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
    }

    const channelInHub = await db.connectedList.findFirst({ where: { channelId: channel.id } });
    if (channelInHub) {
      const alrJoinedHub = await db.hubs.findFirst({ where: { id: channelInHub?.hubId } });
      return await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.alreadyJoined', locale },
              { channel: `${channel.toString()}`, hub: `${alrJoinedHub?.name}`, emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
    }

    let hub: hubs | null = null;

    // bunch of checks to see if hub exists / invite is valid
    if (invite) {
      const fetchedInvite = await db.hubInvites.findFirst({
        where: { code: invite },
        include: { hub: true },
      });

      if (!fetchedInvite) {
        return await interaction.reply({
          embeds: [
            simpleEmbed(
              t({ phrase: 'hub.invite.revoke.invalidCode', locale }, { emoji: emojis.no }),
            ),
          ],
          ephemeral: true,
        });
      }

      hub = fetchedInvite.hub;
    }
    else {
      hub = await db.hubs.findFirst({ where: { name: hubName, private: false } });

      if (!hub) {
        return await interaction.reply({
          embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
          ephemeral: true,
        });
      }
    }

    // actual code starts here
    const alreadyInHub = await db.connectedList.findFirst({
      where: {
        hubId: hub.id,
        serverId: channel.guildId,
      },
    });

    if (alreadyInHub) {
      return await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.alreadyJoined', locale },
              { hub: hub.name, channel: `<#${alreadyInHub.channelId}>`, emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
    }

    const userBlacklisted = await BlacklistManager.fetchUserBlacklist(hub.id, interaction.user.id);
    const serverBlacklisted = await BlacklistManager.fetchServerBlacklist(
      hub.id,
      interaction.guildId,
    );

    if (userBlacklisted || serverBlacklisted) {
      return await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.blacklisted', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
    }

    // display onboarding message, also prevents user from joining twice
    const onboardingCompleted = await showOnboarding(interaction, hub.name, channel.id);
    // if user cancels onboarding or it times out
    if (!onboardingCompleted) {
      return await interaction.deleteReply().catch(() => null);
    }
    else if (onboardingCompleted === 'in-progress') {
      return await interaction.reply({
        embeds: [
          simpleEmbed(
            t({ phrase: 'hub.onboarding.inProgress', locale }, { channel: `${channel}` }),
          ),
        ],
        ephemeral: true,
      });
    }

    const webhook = await getOrCreateWebhook(channel);
    if (!webhook) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.botMissingPermissions', locale },
              { permissions: 'Manage Webhooks', emoji: emojis.no },
            ),
          ),
        ],
        components: [],
      });
      return;
    }

    // finally make the connection
    await connectChannel({
      serverId: channel.guildId,
      channelId: channel.id,
      parentId: channel.isThread() ? channel.parentId : undefined,
      webhookURL: webhook.url,
      hub: { connect: { id: hub.id } },
      connected: true,
      compact: false,
      profFilter: true,
    });

    await interaction.editReply({
      content: t({ phrase: 'hub.join.success', locale }, { channel: `${channel}`, hub: hub.name }),
      embeds: [],
      components: [],
    });

    const totalConnections = interaction.client.connectionCache.reduce(
      (total, c) => total + (c.hubId === hub.id && c.connected ? 1 : 0),
      0,
    );

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
    await logServerJoin(hub.id, interaction.guild, {
      totalConnections,
      hubName,
    });
  }
}
