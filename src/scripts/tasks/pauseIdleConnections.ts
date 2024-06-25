import db from '../../utils/Db.js';
import Logger from '../../utils/Logger.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { modifyConnection } from '../../utils/ConnectedList.js';
import { APIActionRowComponent, APIButtonComponent, Snowflake } from 'discord.js';
import { buildConnectionButtons } from '../network/components.js';
import { simpleEmbed } from '../../utils/Utils.js';
import { stripIndents } from 'common-tags';
import { emojis } from '../../utils/Constants.js';
import 'dotenv/config';

export default async (manager: ClusterManager) => {
  const connections = await db.connectedList.findMany({
    where: {
      connected: true,
      lastActive: { not: null, lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (connections?.length === 0) return;

  const reconnectButtonArr: {
    channelId: Snowflake;
    button: APIActionRowComponent<APIButtonComponent>;
  }[] = [];

  // Loop through the data
  connections.forEach(async ({ channelId, lastActive }) => {
    Logger.debug(
      `[InterChat]: Channel ${channelId} is older than 24 hours: ${lastActive?.toLocaleString()} - ${new Date().toLocaleString()}`,
    );

    // Create the button
    reconnectButtonArr.push({
      channelId,
      button: buildConnectionButtons(false, channelId, {
        customCustomId: 'inactiveConnect',
      }).toJSON(),
    });

    // disconnect the channel
    await modifyConnection({ channelId }, { connected: false });
  });

  const embed = simpleEmbed(
    stripIndents`
    ### ${emojis.timeout} Paused Due to Inactivity
    Connection to this hub has been stopped because no messages were sent for past day. **Click the button** below to resume chatting (or alternatively, \`/connection\`).
    `,
  ).toJSON();

  await manager.broadcastEval(
    (client, { _connections, _embed, buttons }) => {
      _connections.forEach(async (connection) => {
        const channel = await client.channels.fetch(connection.channelId).catch(() => null);
        const button = buttons.find((b) => b.channelId === connection.channelId)?.button;

        if (!channel?.isTextBased() || !button) return;

        // remove it since we are done with it
        _connections.splice(_connections.indexOf(connection), 1);

        await channel.send({ embeds: [_embed], components: [button] }).catch(() => null);
      });
    },
    { context: { _connections: connections, _embed: embed, buttons: reconnectButtonArr } },
  );
};
