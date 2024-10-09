import Constants from '#main/config/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { ErrorEmbed } from '#utils/EmbedUtils.js';
import Logger from '#utils/Logger.js';
import type { RemoveMethods, ThreadParentChannel } from '#types/index.d.ts';
import { captureException } from '@sentry/node';
import type { ClusterManager } from 'discord-hybrid-sharding';
import {
  EmbedBuilder,
  type ColorResolvable,
  type CommandInteraction,
  type GuildTextBasedChannel,
  type Interaction,
  type Message,
  type MessageComponentInteraction,
  type RepliableInteraction,
  type Snowflake,
  type VoiceBasedChannel,
} from 'discord.js';
import startCase from 'lodash/startCase.js';
import toLower from 'lodash/toLower.js';

export const resolveEval = <T>(value: T[]) =>
  value?.find((res) => Boolean(res)) as RemoveMethods<T> | undefined;

export const msToReadable = (milliseconds: number, short = true): string => {
  if (milliseconds < 0) return 'Invalid input';
  if (milliseconds === 0) return short ? '0s' : '0 seconds';

  const timeUnits = [
    { div: 31536000000, short: 'y', long: 'year' },
    { div: 2629746000, short: 'm', long: 'month' },
    { div: 86400000, short: 'd', long: 'day' },
    { div: 3600000, short: 'h', long: 'hour' },
    { div: 60000, short: 'm', long: 'minute' },
    { div: 1000, short: 's', long: 'second' },
  ];

  let remainingMs = milliseconds;
  const parts: string[] = [];

  for (const unit of timeUnits) {
    const value = Math.floor(remainingMs / unit.div);
    if (value > 0) {
      // eslint-disable-next-line no-nested-ternary
      const suffix = short ? unit.short : value === 1 ? ` ${unit.long}` : ` ${unit.long}s`;

      parts.push(`${value}${suffix}`);
      remainingMs %= unit.div;
    }
  }

  // Limit to two most significant parts for readability
  return parts.join(' ');
};

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const yesOrNoEmoji = (option: unknown, yesEmoji: string, noEmoji: string) =>
  option ? yesEmoji : noEmoji;

export const disableComponents = (message: Message) =>
  message.components.flatMap((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => (component.disabled = true));
    return jsonRow;
  });

const findExistingWebhook = async (channel: ThreadParentChannel | VoiceBasedChannel) => {
  const webhooks = await channel?.fetchWebhooks().catch(() => null);
  return webhooks?.find((w) => w.owner?.id === channel.client.user?.id);
};

const createWebhook = async (channel: ThreadParentChannel | VoiceBasedChannel, avatar: string) =>
  await channel
    ?.createWebhook({
      name: 'InterChat Network',
      avatar,
    })
    .catch(() => undefined);

export const getOrCreateWebhook = async (
  channel: GuildTextBasedChannel,
  avatar = Constants.Links.EasterAvatar,
) => {
  const channelOrParent = channel.isThread() ? channel.parent : channel;
  if (!channelOrParent) return null;

  const existingWebhook = await findExistingWebhook(channelOrParent);
  return existingWebhook || (await createWebhook(channelOrParent, avatar));
};

export const getCredits = () => [
  ...Constants.DeveloperIds,
  ...Constants.StaffIds,
  ...Constants.SupporterIds,
];

export const checkIfStaff = (userId: string, onlyCheckForDev = false) => {
  const staffMembers = [...Constants.DeveloperIds, ...(onlyCheckForDev ? [] : Constants.StaffIds)];
  return staffMembers.includes(userId);
};

export const deleteMsgsFromDb = async (broadcastMsgs: string[]) => {
  // delete all relations first and then delete the hub
  const msgsToDelete = await db.broadcastedMessages.findMany({
    where: { messageId: { in: broadcastMsgs } },
  });
  if (!msgsToDelete) return null;

  const originalMsgIds = msgsToDelete.map(({ originalMsgId }) => originalMsgId);

  const childrenBatch = db.broadcastedMessages.deleteMany({
    where: { originalMsgId: { in: originalMsgIds } },
  });
  const originalBatch = db.originalMessages.deleteMany({
    where: { messageId: { in: originalMsgIds } },
  });

  return await db.$transaction([childrenBatch, originalBatch]);
};

export const replaceLinks = (string: string, replaceText = '`[LINK HIDDEN]`') =>
  string.replaceAll(Constants.Regex.Links, replaceText);

export const calculateAverageRating = (ratings: number[]): number => {
  if (ratings.length === 0) return 0;

  const sum = ratings.reduce((acc, cur) => acc + cur, 0);
  const average = sum / ratings.length;
  return Math.round(average * 10) / 10;
};

export const toTitleCase = (str: string) => startCase(toLower(str));

export const getReplyMethod = (
  interaction: RepliableInteraction | CommandInteraction | MessageComponentInteraction,
) => (interaction.replied || interaction.deferred ? 'followUp' : 'reply');

/**
    Invoke this method to handle errors that occur during command execution.
    It will send an error message to the user and log the error to the system.
  */
export const sendErrorEmbed = async (interaction: RepliableInteraction, errorCode: string) => {
  const method = getReplyMethod(interaction);
  const errorEmbed = new ErrorEmbed({ errorCode });

  return await interaction[method]({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
};

export const handleError = (e: Error, interaction?: Interaction) => {
  // log the error to the system
  Logger.error(e);

  const extra = interaction
    ? {
      user: { id: interaction.user.id, username: interaction.user.username },
      extra: {
        type: interaction.type,
        identifier:
            interaction.isCommand() || interaction.isAutocomplete()
              ? interaction.commandName
              : CustomID.parseCustomId(interaction.customId),
      },
    }
    : undefined;

  // capture the error to Sentry.io with additional information
  const errorCode = captureException(e, extra);

  // reply with an error message to the user
  if (interaction?.isRepliable()) sendErrorEmbed(interaction, errorCode).catch(Logger.error);
};

export const isDev = (userId: Snowflake) => Constants.DeveloperIds.includes(userId);

export const escapeRegexChars = (input: string): string =>
  input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

export const parseEmoji = (emoji: string) => {
  const match = emoji.match(Constants.Regex.Emoji);
  if (!match) return null;

  const [, animated, name, id] = match;
  return { animated: Boolean(animated), name, id };
};

export const getEmojiId = (emoji: string | undefined) => {
  const res = parseEmoji(emoji || '');
  return res?.id ?? emoji;
};
// get ordinal suffix for a number
export const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;

  if (j === 1 && k !== 11) return 'st';
  else if (j === 2 && k !== 12) return 'nd';
  else if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

export const getUsername = async (client: ClusterManager, userId: Snowflake) => {
  if (!client) return null;

  const username = resolveEval(
    await client.broadcastEval(
      async (c, ctx) => {
        const user = await c.users.fetch(ctx.userId).catch(() => null);
        return user?.username;
      },
      { context: { userId } },
    ),
  );

  return username;
};

export const modifyUserRole = async (
  cluster: ClusterManager,
  action: 'add' | 'remove',
  {
    userId,
    roleId,
    guildId = Constants.SupportServerId,
  }: { userId: Snowflake; roleId: Snowflake; guildId?: Snowflake },
) => {
  await cluster.broadcastEval(
    async (client, ctx) => {
      const guild = client.guilds.cache.get(ctx.guildId);
      if (!guild) return;

      const role = await guild.roles.fetch(ctx.roleId);
      if (!role) return;

      // add or remove role
      const member = await guild.members.fetch(ctx.userId);
      await member?.roles[ctx.action](role);
    },
    { context: { userId, roleId, guildId, action } },
  );
};

export const containsInviteLinks = (str: string) => {
  const inviteLinks = ['discord.gg', 'discord.com/invite', 'dsc.gg'];
  return inviteLinks.some((link) => str.includes(link));
};

export const getTagOrUsername = (username: string, discrim: string) =>
  discrim !== '0' ? `${username}#${discrim}` : username;

export const isHumanMessage = (message: Message) =>
  !message.author.bot && !message.system && !message.webhookId;

export const trimAndCensorBannedWebhookWords = (content: string) =>
  content.slice(0, 35).replace(Constants.Regex.BannedWebhookWords, '[censored]');

export const simpleEmbed = (
  description: string,
  opts?: { color?: ColorResolvable; title?: string },
) =>
  new EmbedBuilder()
    .setTitle(opts?.title ?? null)
    .setColor(opts?.color ?? Constants.Colors.invisible)
    .setDescription(description.toString());
