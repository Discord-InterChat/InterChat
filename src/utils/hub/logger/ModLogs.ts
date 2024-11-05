import BlacklistManager from '#main/managers/BlacklistManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import db from '#utils/Db.js';
import type { Hub, HubLogConfig } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { type Client, codeBlock, EmbedBuilder, type Snowflake, User } from 'discord.js';
import Constants, { emojis } from '#utils/Constants.js';
import { sendLog } from './Default.js';

const getUnblacklistEmbed = (
  type: 'User' | 'Server',
  opts: {
    name: string;
    id: Snowflake;
    mod: User | { id: Snowflake; username: string };
    hubName: string;
    reason?: string;
    originalReason?: string;
  },
) =>
  new EmbedBuilder()
    .setAuthor({ name: `${type} ${opts.name} unblacklisted` })
    .setDescription(
      stripIndents`
      ${emojis.dotBlue} **${type}:** ${opts.name} (${opts.id})
      ${emojis.dotBlue} **Moderator:** ${opts.mod.username} (${opts.mod.id})
      ${emojis.dotBlue} **Hub:** ${opts.hubName}
    `,
    )
    .addFields(
      {
        name: 'Reason for Unblacklist',
        value: opts.reason ?? 'No reason provided.',
        inline: true,
      },
      { name: 'Blacklisted For', value: opts.originalReason ?? 'Unknown', inline: true },
    )
    .setColor(Constants.Colors.interchatBlue)
    .setFooter({
      text: `Unblacklisted by: ${opts.mod.username}`,
      iconURL: opts.mod instanceof User ? opts.mod.displayAvatarURL() : undefined,
    });

type UnblacklistOpts = {
  id: string;
  mod: User | { id: Snowflake; username: string };
  reason?: string;
};

export const logServerUnblacklist = async (
  client: Client,
  hubId: string,
  opts: UnblacklistOpts,
) => {
  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  const blacklistManager = new BlacklistManager(new ServerInfractionManager(opts.id));
  const blacklist = await blacklistManager.fetchBlacklist(hubId);
  if (!BlacklistManager.isServerBlacklist(blacklist) || !hub?.logConfig[0].modLogs) return;

  const embed = getUnblacklistEmbed('Server', {
    id: opts.id,
    name: blacklist.serverName,
    mod: opts.mod,
    hubName: hub.name,
    reason: opts.reason,
    originalReason: blacklist.reason,
  });

  await sendLog(client.cluster, hub.logConfig[0].modLogs, embed);
};

export const logUserUnblacklist = async (client: Client, hubId: string, opts: UnblacklistOpts) => {
  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  const blacklistManager = new BlacklistManager(new UserInfractionManager(opts.id));
  const blacklist = await blacklistManager.fetchBlacklist(hubId);
  if (!blacklist || !hub?.logConfig[0].modLogs) return;

  const user = await client.users.fetch(opts.id).catch(() => null);
  const name = `${user?.username}`;

  const embed = getUnblacklistEmbed('User', {
    name,
    id: opts.id,
    mod: opts.mod,
    reason: opts.reason,
    hubName: hub.name,
    originalReason: blacklist.reason,
  });

  await sendLog(client.cluster, hub.logConfig[0].modLogs, embed);
};

export const logMsgDelete = async (
  client: Client,
  content: string,
  hub: Hub & { logConfig: HubLogConfig[] },
  opts: { userId: string; serverId: string; modName: string; imageUrl?: string },
) => {
  if (!hub?.logConfig[0].modLogs) return;

  const { userId, serverId } = opts;
  const user = await client.users.fetch(userId).catch(() => null);
  const server = await client.fetchGuild(serverId).catch(() => null);

  const embed = new EmbedBuilder()
    .setDescription(
      stripIndents`
      ### ${emojis.deleteDanger_icon} Message Deleted
      **Content:**
      ${codeBlock(content)}
    `,
    )
    .setColor(Constants.Colors.invisible)
    .setImage(opts.imageUrl ?? null)
    .addFields([
      { name: `${emojis.connect_icon} User`, value: `${user?.username} (\`${userId}\`)` },
      { name: `${emojis.rules_icon} Server`, value: `${server?.name} (\`${serverId}\`)` },
      { name: `${emojis.globe_icon} Hub`, value: hub.name },
    ])
    .setFooter({ text: `Deleted by: ${opts.modName}` });

  await sendLog(client.cluster, hub?.logConfig[0].modLogs, embed);
};
