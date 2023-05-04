import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import { createConnection } from '../../Structures/network';
import { stripIndents } from 'common-tags';

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) return;

  const name = interaction.options.getString('name') || undefined;
  const id = interaction.options.getString('id') || undefined;
  const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);

  if (!interaction.member.permissionsIn(channel).has(['ManageChannels'])) {
    return await interaction.reply({
      content: `${interaction.client.emotes.normal.no} You need to have the \`Manage Channels\` permission in ${channel} to connect it to a hub!`,
      ephemeral: true,
    });
  }

  if (!id && !name) {
    return await interaction.reply({
      content: `${interaction.client.emotes.normal.no} You need to provide either a hub name or ID!`,
      ephemeral: true,
    });
  }


  const db = getDb();
  const channelConnected = await db.connectedList.findFirst({ where: { channelId: channel.id } });
  const serverAlreadyInHub = await db.hubs.findFirst({
    where: {
      id,
      name,
      connections: { some: { serverId: interaction.guild?.id } },
    },
  });

  if (channelConnected) {
    return await interaction.reply({
      content: `${channel} is already connected to a hub! Please leave the hub or choose a different channel.`,
      ephemeral: true,
    });
  }
  else if (serverAlreadyInHub) {
    return await interaction.reply({
      content: `This server is already connected to hub **${serverAlreadyInHub.name}** from another channel!`,
      ephemeral: true,
    });
  }

  const hubExists = await db.hubs.findFirst({ where: { name, id } });
  if (!hubExists) {
    return await interaction.reply({
      content: `${interaction.client.emotes.normal.no} Unable to find a hub with that name or ID!`,
      ephemeral: true,
    });
  }
  // the only way to join a private hub is through its ID
  if (hubExists.private && (name && !id)) {
    return await interaction.reply({
      content: `${interaction.client.emotes.normal.no} Unable to find a hub with that name!`,
      ephemeral: true,
    });
  }

  else if (hubExists.private && interaction.user.id !== hubExists.owner.userId) {
    await db.hubs.update({
      where: { id: hubExists?.id },
      data: {
        joinRequests: {
          push: {
            submitterId: interaction.user.id,
            channelId: channel.id,
            serverId: interaction.guild?.id,
          },
        },
      },
    });
    await createConnection({
      serverId: channel.guild.id,
      channelId: channel.id,
      compact: false,
      profFilter: true,
      connected: true,
    });


    await interaction.reply({
      content: `${interaction.client.emotes.normal.yes} Sent a request to join hub **${hubExists.name}**! ${channel} will be automatically connected to the hub once your reqest has been approved!`,
      ephemeral: true,
    });
    return;
  }

  await createConnection({
    serverId: channel.guild.id,
    channelId: channel.id,
    compact: false,
    profFilter: true,
    connected: true,
    hub: { connect: { id: hubExists.id } },
  });

  // TODO: make an onboarding function and show them rules and stuff
  await interaction.reply(`Joined hub **${hubExists.name}**! Use \`/setup edit\` to manage connection settings.`);
  await interaction.client.sendInNetwork(stripIndents`
      A new server has joined the hub! ${interaction.client.emotes.normal.clipart}

      **Server Name:** __${interaction.guild?.name}__
      **Member Count:** __${interaction.guild?.memberCount}__
    `, { id: hubExists.id });
}
