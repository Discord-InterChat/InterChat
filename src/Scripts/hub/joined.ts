import { ChatInputCommandInteraction } from 'discord.js';
import { paginate } from '../../Utils/functions/paginator';
import { createHubListingsEmbed, getDb } from '../../Utils/functions/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  const db = getDb();
  const joinedHubs = await db.hubs.findMany({
    where: {
      connections: { some: { serverId: interaction.guild?.id } },
    },
    include: {
      connections: true,
    },
  });

  if (joinedHubs.length === 0) {
    interaction.reply({
      content: `${interaction.client.emotes.normal.no} You have not any hubs yet!`,
      ephemeral: true,
    });
  }

  const hubList = joinedHubs.map(async hub => {
    const filterConnections = await db.connectedList
      .count({ where: { hubId: hub.id } })
      .catch(() => 0);
    // use a more meaningful embed for this lmao
    return createHubListingsEmbed(hub, { totalNetworks: filterConnections })
      .addFields({
        name: 'Channel',
        value: `<#${hub.connections.find(c => c.serverId === interaction.guildId)?.channelId}>`,
      });
  });

  paginate(interaction, await Promise.all(hubList));
}
