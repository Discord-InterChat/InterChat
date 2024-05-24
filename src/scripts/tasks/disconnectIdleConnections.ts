import db from '../../utils/Db.js';
import Logger from '../../utils/Logger.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { modifyConnection } from '../../utils/ConnectedList.js';
import 'dotenv/config';
import { colors, emojis } from '../../utils/Constants.js';
import { APIActionRowComponent, APIButtonComponent, EmbedBuilder, Snowflake } from 'discord.js';
import { buildConnectionButtons } from '../network/components.js';

export default async (manager: ClusterManager) => {
  const connections = await db.connectedList.findMany({
    where: {
      connected: true,
      lastActive: { not: null, lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (!connections) return;

  const reconnectButtonArr: {
    channelId: Snowflake;
    button: APIActionRowComponent<APIButtonComponent>;
  }[] = [];

  // Loop through the data
  connections.forEach(({ channelId, lastActive }) => {
    Logger.info(`Channel ${channelId} is older than 1 minute: ${lastActive?.toLocaleString()} - ${new Date().toLocaleString()}`);
    modifyConnection({ channelId }, { lastActive: null, connected: false });

    reconnectButtonArr.push({
      channelId,
      button: buildConnectionButtons(false, channelId, { customCustomId: 'inactiveConnect' }).toJSON(),
    });
  });

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.timeout} Paused Due to Inactivity`)
    .setDescription('Messages to and from hub have been stopped. **Click the button** below to below to resume chatting (or alternatively, `/connection`).')
    .setColor(colors.invisible).toJSON();

  await manager.broadcastEval(
    (client, { _connections, _embed, buttons }) => {
      _connections.forEach(async (connection) => {
        const channel = await client.channels.fetch(connection.channelId).catch((e) => {
          Logger.error(e);
          return null;
        });

        const button = buttons.find((b) => b.channelId === connection.channelId)?.button;
        if (!channel?.isTextBased() || !button) return;

        // remove it since we are done
        _connections.splice(_connections.indexOf(connection), 1);

        await channel
          .send({
            embeds: [_embed],
            components: [button],
          })
          .catch(() => null);
      });
    },
    {
      context: { _connections: connections, _embed: embed, buttons: reconnectButtonArr },
    },
  );
};
