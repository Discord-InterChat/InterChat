import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { getDb } from '../../Utils/utils';
import displaySettings from '../network/displaySettings';
import emojis from '../../Utils/JSON/emoji.json';
import onboarding from '../network/onboarding';
import { fetchServerBlacklist, fetchUserBlacklist } from '../../Utils/blacklist';
import { createConnection } from '../../Utils/network';

export default {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const db = getDb();
    const name = interaction.options.getString('name') || undefined;
    const invite = interaction.options.getString('invite') || undefined;
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);
    let hubExists;

    if (!interaction.member.permissionsIn(channel).has(['ManageChannels'])) {
      return await interaction.reply({
        content: `${emojis.normal.no} You need to have the \`Manage Channels\` permission in ${channel} to connect it to a hub!`,
        ephemeral: true,
      });
    }

    if (!invite && !name) {
      return await interaction.reply({
        content: `${emojis.normal.no} You need to provide either a hub name or invite!`,
        ephemeral: true,
      });
    }
    const channelConnected = await db.connectedList.findFirst({ where: { channelId: channel.id } });
    if (channelConnected) {
      return await interaction.reply({
        content: `${channel} is already part of a hub! Please leave the hub or choose a different channel.`,
        ephemeral: true,
      });
    }

    if (invite) {
      const inviteExists = await db.hubInvites.findFirst({
        where: { code: invite },
        include: { hub: { include: { connections: true } } },
      });

      if (!inviteExists) {
        return await interaction.reply({
          content: `${emojis.normal.no} Invalid invite code. Please recheck if that code is correct.`,
          ephemeral: true,
        });
      }
      const guildInHub = inviteExists.hub.connections.find((c) => c.serverId === channel.guildId);
      if (guildInHub) {
        return await interaction.reply({
          content: `This server has already joined hub **${inviteExists.hub.name}** from <#${guildInHub.channelId}>! Please leave the hub from that channel first, or change the channel using \`/network manage\`.!`,
          ephemeral: true,
        });
      }

      hubExists = inviteExists?.hub;
    }

    else if (name) {
      hubExists = await db.hubs.findFirst({
        where: { name },
        include: { connections: true },
      });

      if (!hubExists) {
        return await interaction.reply({
          content: `${emojis.normal.no} Unable to find a hub with that name!`,
          ephemeral: true,
        });
      }

      const guildInHub = hubExists.connections.find(c => c.serverId === channel.guildId);
      if (guildInHub) {
        return await interaction.reply({
          content: `This server has already joined hub **${hubExists?.name}** from <#${guildInHub.channelId}>! Please leave the hub from that channel first, or change the channel using \`/network manage\`.`,
          ephemeral: true,
        });
      }

      // the only way to join a private hub is through it's invite code
      if (hubExists?.private && !invite) {
        return await interaction.reply({
          content: `${emojis.normal.no} Unable to find a hub with that name!`,
          ephemeral: true,
        });
      }
    }

    if (!hubExists) return interaction.reply({ content: 'An error occured.', ephemeral: true });


    const serverInBlacklist = await fetchServerBlacklist(hubExists.id, channel.guildId);
    if (serverInBlacklist) {
      await interaction.reply('This server is blacklisted from joining this hub.');
      return;
    }

    const userInBlacklist = await fetchUserBlacklist(hubExists.id, interaction.user.id);
    if (userInBlacklist) {
      await interaction.reply('You have been blacklisted from joining this hub.');
      return;
    }

    if (!await onboarding.execute(interaction, hubExists.name, channel.id)) return interaction.deleteReply().catch(() => null);

    const created = await createConnection(interaction.guild, hubExists, channel).catch(() => {
      interaction.reply({
        content: `${emojis.normal.no} An error occured while connecting this channel to the hub! Please make sure I have the [required permissions](https://discord-interchat.github.io/docs/#adding-interchat-to-your-server) and try again.`,
        ephemeral: true,
      });
      return null;
    });

    if (created) await displaySettings.execute(interaction, created.channelId);
  },
};