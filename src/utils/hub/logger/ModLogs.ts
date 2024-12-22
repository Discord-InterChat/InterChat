import BlacklistManager from '#main/managers/BlacklistManager.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import HubManager from '#main/managers/HubManager.js';
import { OriginalMessage } from '#main/utils/network/messageUtils.js';
import Constants, { emojis } from '#utils/Constants.js';
import { stripIndents } from 'common-tags';
import { type Client, codeBlock, EmbedBuilder, type Snowflake, User } from 'discord.js';
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
  hub: HubManager,
  opts: UnblacklistOpts,
) => {
  const blacklistManager = new BlacklistManager('server', opts.id);
  const blacklist = await blacklistManager.fetchBlacklist(hub.id);

  const logConfig = await hub.fetchLogConfig();
  const modLogs = logConfig.config.modLogs;
  if (!blacklist?.serverName || !modLogs) return;

  const embed = getUnblacklistEmbed('Server', {
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

  const embed = getUnblacklistEmbed('User', {
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
  opts: { hubName: string; modName: string; },
) => {
  const modLogs = logConfig.config.modLogs;
  if (!modLogs?.channelId) return;

  const { authorId, guildId, content } = originalMsg;
  const user = await client.users.fetch(authorId).catch(() => null);
  const server = await client.fetchGuild(guildId).catch(() => null);

  const embed = new EmbedBuilder()
    .setDescription(
      stripIndents`
      ### ${emojis.deleteDanger_icon} Message Deleted
      **Content:**
      ${codeBlock(content)}
    `,
    )
    .setColor(Constants.Colors.invisible)
    .setImage(originalMsg.imageUrl ?? null)
    .addFields([
      { name: `${emojis.connect_icon} User`, value: `${user?.username} (\`${authorId}\`)` },
      { name: `${emojis.rules_icon} Server`, value: `${server?.name} (\`${guildId}\`)` },
      { name: `${emojis.globe_icon} Hub`, value: opts.hubName },
    ])
    .setFooter({ text: `Deleted by: ${opts.modName}` });

  await sendLog(client.cluster, modLogs.channelId, embed);
};
