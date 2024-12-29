import { buildConnectionButtons } from '#main/interactions/InactiveConnect.js';
import Constants from '#main/utils/Constants.js';
import { updateConnections } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import Logger from '#utils/Logger.js';
import { Connection, Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import 'dotenv/config';

const INACTIVITY_HOURS = 24;
const MIN_CONNECTIONS = 50;
const BATCH_SIZE = 100;

function createInactivityEmbed() {
  return new InfoEmbed().removeTitle().setDescription(
    stripIndents`
        ### :alarm_clock: Paused Due to Inactivity
        Messages will not be sent to this channel until you reconnect because it has been inactive for over ${INACTIVITY_HOURS} hours.

        -# Click the **button** below or use **\`/connection unpause\`** to resume chatting.
      `,
  );
}

async function findHubsWithIdleConnections() {
  const cutoffDate = new Date(Date.now() - INACTIVITY_HOURS * 60 * 60 * 1000);

  try {
    const hubs = await db.hub.findMany({
      where: {
        connections: {
          some: {
            connected: true,
            lastActive: { lte: cutoffDate },
          },
        },
      },
      include: {
        connections: {
          where: {
            connected: true,
            lastActive: { lte: cutoffDate },
          },
          orderBy: { lastActive: 'asc' },
        },
      },
    });

    return hubs.filter((hub) => hub.connections.length >= MIN_CONNECTIONS);
  }
  catch (error) {
    Logger.error('[InterChat]: Failed to fetch idle hubs:', error);
    return [];
  }
}

async function sendInactivityNotifications(
  connections: Connection[],
  hub: Hub,
  embed: EmbedBuilder,
) {
  const channelIds = [];

  for (const connection of connections) {
    try {
      const webhook = new WebhookClient({ url: connection.webhookURL });
      const button = buildConnectionButtons(false, connection.channelId, {
        customCustomId: 'inactiveConnect',
      });

      await webhook.send({
        embeds: [embed],
        components: button ? [button] : [],
        avatarURL: hub.iconUrl || Constants.Links.EasterAvatar,
      });

      channelIds.push(connection.channelId);
      Logger.debug(
        `[InterChat]: Processing ${connection.channelId}, last active: ${connection.lastActive.toLocaleString()}`,
      );
    }
    catch (error) {
      Logger.error(`[InterChat]: Failed to notify channel ${connection.channelId}:`, error);
    }

    // Small delay between webhooks to prevent rate limiting
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return channelIds;
}

async function disconnectChannels(channelIds: string[]) {
  if (!channelIds.length) return;

  try {
    await updateConnections({ channelId: { in: channelIds } }, { connected: false });
    Logger.info(`[InterChat]: Paused ${channelIds.length} connections`);
  }
  catch (error) {
    Logger.error('[InterChat]: Failed to update connections:', error);
  }
}

export default async () => {
  try {
    const hubs = await findHubsWithIdleConnections();
    if (!hubs.length) return;

    const embed = createInactivityEmbed();
    const processedChannels = [];

    for (const hub of hubs) {
      // Process in batches to manage memory and rate limits
      for (let i = 0; i < hub.connections.length; i += BATCH_SIZE) {
        const batch = hub.connections.slice(i, i + BATCH_SIZE);
        const notifiedChannels = await sendInactivityNotifications(batch, hub, embed);
        processedChannels.push(...notifiedChannels);

        if (i + BATCH_SIZE < hub.connections.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    await disconnectChannels(processedChannels);
  }
  catch (error) {
    Logger.error('[InterChat]: Unexpected error in inactive connection handler:', error);
  }
};
