import { ChatInputCommandInteraction } from 'discord.js';
import { paginate } from '../../Utils/functions/paginator';
import { createHubListingsEmbed, getDb } from '../../Utils/functions/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  const db = getDb();
  const joinedHubs = await db.hubs.findMany({
    where: {
      connections: { some: { serverId: interaction.guild?.id } },
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
    return createHubListingsEmbed(hub, { totalNetworks: filterConnections });
  });

  paginate(interaction, await Promise.all(hubList));
}
