import { stripIndents } from 'common-tags';
import { type Client, EmbedBuilder, type Snowflake, User, codeBlock } from 'discord.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import type HubLogManager from '#main/managers/HubLogManager.js';
import type HubManager from '#main/managers/HubManager.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import type { OriginalMessage } from '#main/utils/network/messageUtils.js';
import Constants from '#utils/Constants.js';
import { sendLog } from './Default.js';

const getUnblacklistEmbed = (
  type: 'User' | 'Server',
  client: Client,
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
      ${getEmoji('dotBlue', client)} **${type}:** ${opts.name} (${opts.id})
      ${getEmoji('dotBlue', client)} **Moderator:** ${opts.mod.username} (${opts.mod.id})
      ${getEmoji('dotBlue', client)} **Hub:** ${opts.hubName}
    `,
    )
    .addFields(
      {
        name: 'Reason for Unblacklist',
        value: opts.reason ?? 'No reason provided.',
        inline: true,
      },
      {
        name: 'Blacklisted For',
        value: opts.originalReason ?? 'Unknown',
        inline: true,
      },
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
  hub: HubManager,
  opts: UnblacklistOpts,
) => {
  const blacklistManager = new BlacklistManager('server', opts.id);
  const blacklist = await blacklistManager.fetchBlacklist(hub.id);

  const logConfig = await hub.fetchLogConfig();
  const modLogs = logConfig.config.modLogs;
  if (!blacklist?.serverName || !modLogs) return;

  const embed = getUnblacklistEmbed('Server', client, {
    id: opts.id,
    name: blacklist.serverName,
    mod: opts.mod,
    hubName: hub.data.name,
    reason: opts.reason,
    originalReason: blacklist.reason,
  });

  await sendLog(client.cluster, modLogs.channelId, embed);
};

export const logUserUnblacklist = async (
  client: Client,
  hub: HubManager,
  opts: UnblacklistOpts,
) => {
  const blacklistManager = new BlacklistManager('user', opts.id);
  const blacklist = await blacklistManager.fetchBlacklist(hub.id);

  const logConfig = await hub.fetchLogConfig();
  const modLogs = logConfig.config.modLogs;
  if (!blacklist || !modLogs) return;

  const user = await client.users.fetch(opts.id).catch(() => null);
  const name = `${user?.username}`;

  const embed = getUnblacklistEmbed('User', client, {
    name,
    id: opts.id,
    mod: opts.mod,
    reason: opts.reason,
    hubName: hub.data.name,
    originalReason: blacklist.reason,
  });

  await sendLog(client.cluster, modLogs.channelId, embed);
};

export const logMsgDelete = async (
  client: Client,
  originalMsg: OriginalMessage,
  logConfig: HubLogManager,
  opts: { hubName: string; modName: string },
) => {
  const modLogs = logConfig.config.modLogs;
  if (!modLogs?.channelId) return;

  const { authorId, guildId, content } = originalMsg;
  const user = await client.users.fetch(authorId).catch(() => null);
  const server = await client.fetchGuild(guildId).catch(() => null);

  const embed = new EmbedBuilder()
    .setDescription(
      stripIndents`
      ### ${getEmoji('deleteDanger_icon', client)} Message Deleted
      **Content:**
      ${codeBlock(content)}
    `,
    )
    .setColor(Constants.Colors.invisible)
    .setImage(originalMsg.imageUrl || null)
    .addFields([
      {
        name: `${getEmoji('person_icon', client)} User`,
        value: `${user?.username} (\`${authorId}\`)`,
      },
      {
        name: `${getEmoji('rules_icon', client)} Server`,
        value: `${server?.name} (\`${guildId}\`)`,
      },
      { name: `${getEmoji('globe_icon', client)} Hub`, value: opts.hubName },
    ])
    .setFooter({ text: `Deleted by: ${opts.modName}` });

  await sendLog(client.cluster, modLogs.channelId, embed);
};
