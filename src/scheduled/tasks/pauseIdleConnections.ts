import { emojis } from '#utils/Constants.js';
import { updateConnections } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import Logger from '#utils/Logger.js';
import { buildConnectionButtons } from '#utils/network/components.js';
import { stripIndents } from 'common-tags';
import { ClusterManager } from 'discord-hybrid-sharding';
import { type APIActionRowComponent, type APIButtonComponent, type Snowflake } from 'discord.js';
import 'dotenv/config';

export default async (manager: ClusterManager) => {
  const connections = await db.connectedList.findMany({
    where: { connected: true, lastActive: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  if (!connections || connections.length === 0) return;

  const reconnectButtonArr: {
    channelId: Snowflake;
    button: APIActionRowComponent<APIButtonComponent>;
  }[] = [];

  const channelIds: string[] = [];

  // Loop through the data
  connections.forEach(({ channelId, lastActive }) => {
    Logger.info(
      `[InterChat]: Pausing inactive connection ${channelId} due to inactivity since ${lastActive?.toLocaleString()} - ${new Date().toLocaleString()}`,
    );

    channelIds.push(channelId);

    // Create the button
    reconnectButtonArr.push({
      channelId,
      button: buildConnectionButtons(false, channelId, {
        customCustomId: 'inactiveConnect',
      }).toJSON(),
    });
  });

  // disconnect the channel
  await updateConnections({ channelId: { in: channelIds } }, { connected: false });

  const embed = new InfoEmbed()
    .removeTitle()
    .setDescription(
      stripIndents`
    ### ${emojis.timeout} Paused Due to Inactivity
    Connection to this hub has been stopped to save resources because no messages were sent to this channel in the past day.

    -# Click the **button** below or use  **\`/connection unpause\`** to resume chatting.
    `,
    )
    .toJSON();

  await manager.broadcastEval(
    (client, { _connections, _embed, buttons }) => {
      _connections.forEach(async (connection) => {
        const channel = await client.channels.fetch(connection.channelId).catch(() => null);
        const button = buttons.find((b) => b.channelId === connection.channelId)?.button;

        if (!channel?.isTextBased() || channel.isDMBased() || !button) return;

        // remove it since we are done with it
        _connections.splice(_connections.indexOf(connection), 1);

        await channel.send({ embeds: [_embed], components: [button] }).catch(() => null);
      });
    },
    { context: { _connections: connections, _embed: embed, buttons: reconnectButtonArr } },
  );
};
