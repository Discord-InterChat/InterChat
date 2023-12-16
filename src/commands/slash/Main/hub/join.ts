import { ChannelType, ChatInputCommandInteraction } from 'discord.js';
import { emojis } from '../../../../utils/Constants.js';
import Hub from './index.js';
import db from '../../../../utils/Db.js';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import { hubs } from '@prisma/client';
import { simpleEmbed, getOrCreateWebhook } from '../../../../utils/Utils.js';
import { showOnboarding } from '../../../../scripts/network/onboarding.js';
import { stripIndents } from 'common-tags';

export default class JoinSubCommand extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    if (!interaction.inCachedGuild()) return;

    const networkManager = interaction.client.getNetworkManager();
    const hubName = interaction.options.getString('hub') ?? 'InterChat Central';
    const invite = interaction.options.getString('invite');
    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);

    const channelInHub = await networkManager.fetchConnection({ channelId: channel.id });
    if (channelInHub) {
      return await interaction.reply({
        content: `${emojis.no} You are already connected to a hub from ${channel}.`,
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
          content: `${emojis.no} That invite code is invalid.`,
          ephemeral: true,
        });
      }

      hub = fetchedInvite.hub;
    }
    else {
      hub = await db.hubs.findFirst({ where: { name: hubName } });

      if (!hub) {
        return await interaction.reply({
          content: `${emojis.no} That hub does not exist.`,
          ephemeral: true,
        });
      }
    }

    // actual code starts here
    const alreadyInHub = await networkManager.fetchConnection({
      hubId: hub.id,
      serverId: channel.guildId,
    });

    if (alreadyInHub) {
      return await interaction.reply({
        content: `${emojis.no} You are already connected to this hub from <#${alreadyInHub.channelId}>.`,
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
        content: `${emojis.no} You or this server is blacklisted from this hub.`,
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
        content: `${emojis.no} An attempt to join a hub in <#${channel.id}> is currently in progress. Please wait for it to complete before making another attempt.`,
        ephemeral: true,
      });
    }

    const webhook = await getOrCreateWebhook(channel);
    if (!webhook) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            `${emojis.no} I could not create a webhook in ${channel}. Please make sure I have the \`Manage Webhooks\` permission in that channel.`,
          ),
        ],
        components: [],
      });
      return;
    }

    // finally make the connection
    await networkManager.createConnection({
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
      content: `${emojis.yes} You have successfully joined **${hub.name}** from ${channel}. Use \`/connection\` to configure your connection.`,
      embeds: [],
      components: [],
    });

    const totalConnections = await db.connectedList.count({
      where: { hubId: hub.id, connected: true },
    });

    // announce
    await networkManager.sendToHub(hub.id, {
      username: `InterChat | ${hub.name}`,
      content: stripIndents`
      A new server has joined the hub! ${emojis.clipart}

      **Server Name:** __${interaction.guild.name}__
      **Member Count:** __${interaction.guild.memberCount}__

      We now have **${totalConnections}** servers with us!
    `,
    });
  }
}
