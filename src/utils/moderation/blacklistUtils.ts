import Constants, { emojis } from '#main/config/Constants.js';
import { getHubConnections } from '#main/utils/ConnectedListUtils.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import { ServerInfraction, UserInfraction } from '@prisma/client';
import { Client, EmbedBuilder, Snowflake, User } from 'discord.js';

export const isBlacklisted = <T extends UserInfraction | ServerInfraction>(
  infraction: T | null,
): infraction is T =>
  Boolean(
    infraction?.type === 'BLACKLIST' &&
    infraction.status === 'ACTIVE' &&
    (!infraction.expiresAt || infraction.expiresAt > new Date()),
  );

export const buildBlacklistNotifEmbed = (
  type: 'user' | 'server',
  opts: {
    hubName: string;
    expiresAt: Date | null;
    reason?: string;
  },
) => {
  const expireString = opts.expiresAt
    ? `<t:${Math.round(opts.expiresAt.getTime() / 1000)}:R>`
    : 'Never';

  const targetStr = type === 'user' ? 'You' : 'This server';

  return new EmbedBuilder()
    .setTitle(`${emojis.blobFastBan} Blacklist Notification`)
    .setDescription(`${targetStr} has been blacklisted from talking in hub **${opts.hubName}**.`)
    .setColor(Constants.Colors.interchatBlue)
    .setFields(
      { name: 'Reason', value: opts.reason ?? 'No reason provided.', inline: true },
      { name: 'Expires', value: expireString, inline: true },
    );
};

interface BlacklistOpts {
  target: User | { id: Snowflake };
  hubId: string;
  expiresAt: Date | null;
  reason?: string;
}

/** * Notify a user or server that they have been blacklisted. */
export const sendBlacklistNotif = async (
  type: 'user' | 'server',
  client: Client,
  opts: BlacklistOpts,
) => {
  try {
    const hub = await db.hub.findUnique({ where: { id: opts.hubId } });
    const embed = buildBlacklistNotifEmbed(type, {
      hubName: `${hub?.name}`,
      expiresAt: opts.expiresAt,
      reason: opts.reason,
    });

    if (type === 'user') {
      await (opts.target as User).send({ embeds: [embed] }).catch(() => null);
    }
    else {
      const serverInHub =
        (await getHubConnections(opts.hubId))?.find((con) => con.serverId === opts.target.id) ??
        (await db.connectedList.findFirst({
          where: { serverId: opts.target.id, hubId: opts.hubId },
        }));

      if (!serverInHub) return;
      await client.cluster.broadcastEval(
        async (_client, ctx) => {
          const channel = await _client.channels.fetch(ctx.channelId).catch(() => null);
          if (!_client.isGuildTextBasedChannel(channel)) return;

          await channel.send({ embeds: [ctx.embed] }).catch(() => null);
        },
        { context: { channelId: serverInHub.channelId, embed: embed.toJSON() } },
      );
    }
  }
  catch (error) {
    Logger.error(error);
  }
};
