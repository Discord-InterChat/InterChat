import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import initialize from '../network/initialize';
import displaySettings from '../network/displaySettings';
import { connectedList, hubs } from '@prisma/client';

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) return;

  const db = getDb();
  const name = interaction.options.getString('name') || undefined;
  const invite = interaction.options.getString('invite') || undefined;
  const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);
  const channelConnected = await db.connectedList.findFirst({ where: { channelId: channel.id } });
  let hubExists: hubs | null = null;

  if (!interaction.member.permissionsIn(channel).has(['ManageChannels'])) {
    return await interaction.reply({
      content: `${interaction.client.emotes.normal.no} You need to have the \`Manage Channels\` permission in ${channel} to connect it to a hub!`,
      ephemeral: true,
    });
  }

  if (!invite && !name) {
    return await interaction.reply({
      content: `${interaction.client.emotes.normal.no} You need to provide either a hub name or invite!`,
      ephemeral: true,
    });
  }
  if (channelConnected) {
    return await interaction.reply({
      content: `${channel} is already connected to a hub! Please leave the hub or choose a different channel.`,
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
        content: `${interaction.client.emotes.normal.no} Invalid invite code. Please recheck if that code is correct.`,
        ephemeral: true,
      });
    }
    else if (inviteExists.hub.connections.find((c) => c.channelId === channel.id)) {
      return await interaction.reply({
        content: `This server is already connected to hub **${inviteExists.hub.name}** from another channel!`,
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
        content: `${interaction.client.emotes.normal.no} Unable to find a hub with that name!`,
        ephemeral: true,
      });
    }

    else if ((hubExists as hubs & { connections: connectedList}).connections.channelId === channel.id) {
      return await interaction.reply({
        content: `This server is already connected to hub **${hubExists?.name}** from another channel!`,
        ephemeral: true,
      });
    }

    // the only way to join a private hub is through it's invite code
    if (hubExists?.private && !invite) {
      return await interaction.reply({
        content: `${interaction.client.emotes.normal.no} Unable to find a hub with that name!`,
        ephemeral: true,
      });
    }
  }

  if (!hubExists) return interaction.reply({ content: 'An error occured.', ephemeral: true });


  const serverInBlacklist = await db.blacklistedServers.findFirst({
    where: {
      serverId: interaction.guild?.id,
      hubId: hubExists.id,
    },
  });
  if (serverInBlacklist) {
    await interaction.reply('This server is blacklisted from joining this hub.');
    return;
  }

  const userInBlacklist = await db.blacklistedUsers.findFirst({
    where: {
      hubId: hubExists.id,
      userId: interaction.user.id,
    },
  });
  if (userInBlacklist) {
    await interaction.reply('You have been blacklisted from joining this hub.');
    return;
  }

  // TODO: make an onboarding function and show them rules and stuff
  initialize.execute(interaction, hubExists, channel)
    .then(success => { if (success) displaySettings.execute(interaction, success.channelId); });
}
