import { buildConnectionButtons } from '#main/interactions/InactiveConnect.js';
import { updateConnections } from '#utils/ConnectedListUtils.js';
import { emojis } from '#utils/Constants.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import Logger from '#utils/Logger.js';
import { connectedList } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, Collection, WebhookClient } from 'discord.js';
import 'dotenv/config';

export default async () => {
  const connections = await findInactiveConnections();
  if (!connections.length) return;

  const reconnectButtonMap = new Collection<string, ActionRowBuilder<ButtonBuilder>>(
    connections.map((c) => [
      c.channelId,
      buildConnectionButtons(false, c.channelId, { customCustomId: 'inactiveConnect' }),
    ]),
  );

  // disconnect the channel
  await updateConnections(
    { channelId: { in: connections.map((c) => c.channelId) } },
    { connected: false },
  );

  const embed = new InfoEmbed()
    .removeTitle()
    .setDescription(
      stripIndents`
      ### ${emojis.timeout} Paused Due to Inactivity
      Messages will not be sent to this channel until you reconnect because it has been inactive for over 24 hours.

      -# Click the **button** below or use  **\`/connection unpause\`** to resume chatting.
    `,
    )
    .toJSON();

  connections.forEach(async (connection) => {
    Logger.debug(
      `[InterChat]: Paused connection ${connection.channelId}. Last message at: ${connection.lastActive.toLocaleString()}.`,
    );

    const webhook = new WebhookClient({ url: connection.webhookURL });
    const button = reconnectButtonMap.get(connection.channelId);
    const components = button ? [button] : [];

    await webhook.send({ embeds: [embed], components }).catch(() => null);
  });
};

async function findInactiveConnections(): Promise<connectedList[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find all hubs with at least 50 connections
  const start = performance.now();
  const hubsWithInactiveConnections = await db.hub.findMany({
    where: {
      connections: {
        some: { lastActive: { lte: twentyFourHoursAgo } }, // Ensures the hub has at least one connection
      },
    },
    include: {
      connections: { where: { lastActive: { lte: twentyFourHoursAgo } } },
    },
  });

  const inactiveConnections = hubsWithInactiveConnections
    .filter((hub) => hub.connections.length >= 50) // small hubs will die out if we pause it
    .flatMap((hub) => hub.connections);

  Logger.info(
    `Found ${inactiveConnections.length} inactive connections in ${performance.now() - start}ms.`,
  );

  return inactiveConnections;
}
