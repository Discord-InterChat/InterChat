import { ChatInputCommandInteraction } from 'discord.js';
import { paginate } from '../../Utils/functions/paginator';
import { createHubListingsEmbed, getDb } from '../../Utils/functions/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const db = getDb();
  const joinedHubs = await db.hubs.findMany({
    where: {
      connections: { some: { serverId: interaction.guild?.id } },
    },
    include: {
      connections: true,
      messages: true,
    },
  });

  if (joinedHubs.length === 0) {
    return interaction.editReply(`${interaction.client.emotes.normal.no} You have not joined any hubs yet!`);
  }

  const hubList = joinedHubs.map(hub => {
    // use a more meaningful embed for this lmao
    return createHubListingsEmbed(hub, {
      totalNetworks: hub.connections.length,
      hubMessages: hub.messages.length,
    })
      .addFields({
        name: 'Channel',
        value: `<#${hub.connections.find(c => c.serverId === interaction.guildId)?.channelId}>`,
        inline: true,
      });
  });

  paginate(interaction, hubList);
}
