import db from './Db.js';
import Logger from './Logger.js';
import toLower from 'lodash/toLower.js';
import Scheduler from '../services/SchedulerService.js';
import startCase from 'lodash/startCase.js';
import SuperClient from '../core/Client.js';
import {
  ActionRow,
  ApplicationCommand,
  ApplicationCommandOptionType,
  ButtonStyle,
  ChannelType,
  Client,
  Collection,
  ColorResolvable,
  ComponentType,
  EmbedBuilder,
  ForumChannel,
  GuildResolvable,
  Interaction,
  MediaChannel,
  Message,
  MessageActionRowComponent,
  NewsChannel,
  RepliableInteraction,
  Snowflake,
  TextChannel,
  ThreadChannel,
  WebhookClient,
  WebhookMessageCreateOptions,
} from 'discord.js';
import {
  DeveloperIds,
  REGEX,
  StaffIds,
  SupporterIds,
  LINKS,
  colors,
  emojis,
  SUPPORT_SERVER_ID,
} from './Constants.js';
import { createCipheriv, randomBytes } from 'crypto';
import { supportedLocaleCodes, t } from './Locale.js';
import 'dotenv/config';
import { captureException } from '@sentry/node';
import { CustomID } from './CustomID.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { deleteConnection, deleteConnections } from './ConnectedList.js';
import { userData } from '@prisma/client';

/** Convert milliseconds to a human readable time (eg: 1d 2h 3m 4s) */
export const msToReadable = (milliseconds: number) => {
  let totalSeconds = milliseconds / 1000;
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  let readable;

  if (days === 0 && hours === 0 && minutes === 0) readable = `${seconds} seconds`;
  else if (days === 0 && hours === 0) readable = `${minutes}m ${seconds}s`;
  else if (days === 0) readable = `${hours}h, ${minutes}m ${seconds}s`;
  else readable = `${days}d ${hours}h, ${minutes}m ${seconds}s`;

  return readable;
};

export const wait = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/** Sort the array based on the reaction counts */
export const sortReactions = (reactions: { [key: string]: string[] }): [string, string[]][] => {
  // before: { '👍': ['10201930193'], '👎': ['10201930193'] }
  return Object.entries(reactions).sort((a, b) => b[1].length - a[1].length); // => [ [ '👎', ['10201930193'] ], [ '👍', ['10201930193'] ] ]
};

export const hasVoted = async (userId: Snowflake): Promise<boolean> => {
  if (!process.env.TOPGG_API_KEY) throw new TypeError('Missing TOPGG_API_KEY environment variable');

  const res = (await (
    await fetch(`${LINKS.TOPGG_API}/check?userId=${userId}`, {
      method: 'GET',
      headers: {
        Authorization: process.env.TOPGG_API_KEY,
      },
    })
  ).json()) as { voted: boolean };

  return Boolean(res.voted);
};

export const userVotedToday = async (userId: Snowflake): Promise<boolean> => {
  const res = await db.userData.findFirst({
    where: {
      userId,
      lastVoted: { gte: new Date(Date.now() - 60 * 60 * 24 * 1000) },
    },
  });

  return Boolean(res?.lastVoted);
};

export const yesOrNoEmoji = (option: unknown, yesEmoji: string, noEmoji: string) => {
  return option ? yesEmoji : noEmoji;
};

export const disableComponents = (message: Message) => {
  return message.components.flatMap((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => (component.disabled = true));
    return jsonRow;
  });
};

const createWebhook = async (
  channel: NewsChannel | TextChannel | ForumChannel | MediaChannel,
  avatar: string,
) => {
  return await channel
    ?.createWebhook({
      name: 'InterChat Network',
      avatar,
    })
    .catch(() => undefined);
};

const findExistingWebhook = async (
  channel: NewsChannel | TextChannel | ForumChannel | MediaChannel,
) => {
  const webhooks = await channel?.fetchWebhooks().catch(() => null);
  return webhooks?.find((w) => w.owner?.id === channel.client.user?.id);
};

export const getOrCreateWebhook = async (
  channel: NewsChannel | TextChannel | ThreadChannel,
  avatar = LINKS.EASTER_AVATAR,
) => {
  const channelOrParent =
    channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
      ? channel
      : channel.parent;

  if (!channelOrParent) return null;

  const existingWebhook = await findExistingWebhook(channelOrParent);
  return existingWebhook || (await createWebhook(channelOrParent, avatar));
};

export const getCredits = () => {
  return [...DeveloperIds, ...StaffIds, ...SupporterIds];
};

export const checkIfStaff = (userId: string, onlyCheckForDev = false) => {
  const staffMembers = [...DeveloperIds, ...(onlyCheckForDev ? [] : StaffIds)];
  return staffMembers.includes(userId);
};

export const disableAllComponents = (
  components: ActionRow<MessageActionRowComponent>[],
  disableLinks = false,
) => {
  return components.map((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => {
      !disableLinks &&
      component.type === ComponentType.Button &&
      component.style === ButtonStyle.Link
        ? (component.disabled = false) // leave link buttons enabled
        : (component.disabled = true);
    });
    return jsonRow;
  });
};

/**
 *
 * @param scheduler The scheduler to use
 * @param message The message on which to disable components
 * @param time The time in milliseconds after which to disable the components
 */
export const setComponentExpiry = (
  scheduler: Scheduler,
  message: Message,
  time: number | Date,
): string => {
  const timerId = randomBytes(8).toString('hex');
  scheduler.addTask(`disableComponents_${timerId}`, time, async () => {
    const updatedMsg = await message.fetch().catch(() => null);
    if (updatedMsg?.components.length === 0 || !updatedMsg?.editable) return;

    const disabled = disableAllComponents(message.components);
    await updatedMsg.edit({ components: disabled });
  });

  return timerId;
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

export const deleteHubs = async (ids: string[]) => {
  // delete all relations first and then delete the hub
  await deleteConnections({ hubId: { in: ids } });
  await db.hubInvites.deleteMany({ where: { hubId: { in: ids } } });
  await db.originalMessages
    .findMany({ where: { hubId: { in: ids } }, include: { broadcastMsgs: true } })
    .then((m) =>
      deleteMsgsFromDb(
        m.map(({ broadcastMsgs }) => broadcastMsgs.map(({ messageId }) => messageId)).flat(),
      ),
    );

  // finally, delete the hub
  await db.hubs.deleteMany({ where: { id: { in: ids } } });
};

export const replaceLinks = (string: string, replaceText = '`[LINK HIDDEN]`') => {
  return string.replaceAll(REGEX.LINKS, replaceText);
};

export const simpleEmbed = (
  description: string,
  opts?: { color?: ColorResolvable; title?: string },
) => {
  return new EmbedBuilder()
    .setTitle(opts?.title ?? null)
    .setColor(opts?.color ?? colors.invisible)
    .setDescription(description.toString());
};

export const calculateAverageRating = (ratings: number[]): number => {
  if (ratings.length === 0) return 0;

  const sum = ratings.reduce((acc, cur) => acc + cur, 0);
  const average = sum / ratings.length;
  return Math.round(average * 10) / 10;
};

type ImgurResponse = { data: { link: string; nsfw: boolean; cover: string } };

export const checkAndFetchImgurUrl = async (url: string): Promise<string | false> => {
  const regex = REGEX.IMGUR_LINKS;
  const match = url.match(regex);

  if (!match?.[1]) return false;

  const type = match[0].includes('/a/') || match[0].includes('/gallery/') ? 'gallery' : 'image';
  const response = await fetch(`https://api.imgur.com/3/${type}/${match[1]}`, {
    headers: {
      Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
    },
  });

  const data = (await response.json().catch(() => null)) as ImgurResponse;
  if (!data || data?.data?.nsfw) {
    return false;
  }
  // if means the image is an album or gallery
  else if (data.data.cover) {
    // refetch the cover image
    return await checkAndFetchImgurUrl(`https://imgur.com/${data.data.cover}`);
  }

  return data.data.link;
};

export const toTitleCase = (str: string) => {
  return startCase(toLower(str));
};

/**
 * Parses the timestamp from a Snowflake ID and returns it in milliseconds.
 * @param id The Snowflake ID to parse.
 * @returns The timestamp in milliseconds.
 */
export const parseTimestampFromId = (id: Snowflake) => {
  // Convert the snowflake to a BigInt
  const snowflake = BigInt(id);

  // Extract the timestamp from the snowflake (first 42 bits)
  const discordEpoch = 1420070400000n;
  const timestamp = (snowflake >> 22n) + discordEpoch;

  return Number(timestamp);
};

export const channelMention = (channelId: Snowflake | null | undefined) => {
  if (!channelId) return emojis.no;
  return `<#${channelId}>`;
};

const genCommandErrMsg = (locale: supportedLocaleCodes, errorId: string) => {
  return t(
    { phrase: 'errors.commandError', locale },
    { errorId, emoji: emojis.no, support_invite: LINKS.SUPPORT_INVITE },
  );
};

/**
    Invoke this method to handle errors that occur during command execution.
    It will send an error message to the user and log the error to the system.
  */
export const sendErrorEmbed = async (interaction: RepliableInteraction, errorId: string) => {
  const method = interaction.replied || interaction.deferred ? 'followUp' : 'reply';

  // reply with an error message if the command failed
  return await interaction[method]({
    embeds: [simpleEmbed(genCommandErrMsg(interaction.user.locale || 'en', errorId))],
    ephemeral: true,
  }).catch(() => null);
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
  const errorId = captureException(e, extra);

  // reply with an error message to the user
  if (interaction?.isRepliable()) sendErrorEmbed(interaction, errorId).catch(Logger.error);
};

export const isDev = (userId: Snowflake) => {
  return DeveloperIds.includes(userId);
};

export const escapeRegexChars = (input: string): string => {
  return input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export const parseEmoji = (emoji: string) => {
  const match = emoji.match(REGEX.EMOJI);
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

export const getDbUser = async (userId: Snowflake) => {
  return await db.userData.findFirst({ where: { userId } });
};

export const getUsername = async (client: ClusterManager, userId: Snowflake) => {
  if (client) {
    const username = SuperClient.resolveEval(
      await client.broadcastEval(
        async (c, ctx) => {
          const user = await c.users.fetch(ctx.userId).catch(() => null);
          return user?.username;
        },
        { context: { userId } },
      ),
    );

    return username ?? (await getDbUser(userId))?.username ?? null;
  }

  return (await getDbUser(userId))?.username ?? null;
};

export const modifyUserRole = async (
  cluster: ClusterManager,
  action: 'add' | 'remove',
  userId: Snowflake,
  roleId: Snowflake,
  guildId: Snowflake = SUPPORT_SERVER_ID,
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

/**
 * Sends a message to all connections in a hub's network.
 * @param hubId The ID of the hub to send the message to.
 * @param message The message to send. Can be a string or a MessageCreateOptions object.
 * @returns A array of the responses from each connection's webhook.
 */
export const sendToHub = async (hubId: string, message: string | WebhookMessageCreateOptions) => {
  const connections = await db.connectedList.findMany({ where: { hubId } });

  const res = connections
    .filter((c) => c.connected === true)
    .map(async ({ channelId, webhookURL, parentId }) => {
      const threadId = parentId ? channelId : undefined;
      const payload =
        typeof message === 'string' ? { content: message, threadId } : { ...message, threadId };

      try {
        const webhook = new WebhookClient({ url: webhookURL });
        return await webhook.send(payload);
      }
      catch (e) {
        // if the webhook is unknown, delete the connection
        if (e.message.includes('Unknown Webhook')) await deleteConnection({ channelId });

        e.message = `For Connection: ${channelId} ${e.message}`;
        Logger.error(e);
        return null;
      }
    });

  return await Promise.all(res);
};

/**
 * Returns the URL of an attachment in a message, if it exists.
 * @param message The message to search for an attachment URL.
 * @returns The URL of the attachment, or null if no attachment is found.
 */
export const getAttachmentURL = async (string: string) => {
  if (!process.env.TENOR_KEY) throw new TypeError('Tenor API key not found in .env file.');

  // Image URLs
  const URLMatch = string.match(REGEX.STATIC_IMAGE_URL);
  if (URLMatch) return URLMatch[0];

  // Tenor Gifs
  const gifMatch = string.match(REGEX.TENOR_LINKS);
  if (!gifMatch) return null;

  try {
    const id = gifMatch[0].split('-').at(-1);
    const url = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
    const gifJSON = await (await fetch(url)).json();

    return gifJSON.results.at(0)?.media.at(0)?.gif.url as string | null;
  }
  catch (e) {
    Logger.error(e);
    return null;
  }
};

export const fetchHub = async (id: string) => {
  return await db.hubs.findFirst({ where: { id } });
};

export const getUserLocale = (user: userData | undefined | null) => {
  return (user?.locale as supportedLocaleCodes | null | undefined) || 'en';
};

export const containsInviteLinks = (str: string) => {
  const inviteLinks = ['discord.gg', 'discord.com/invite', 'dsc.gg'];
  return inviteLinks.some((link) => str.includes(link));
};

export const fetchCommands = async (client: Client) => {
  return await client.application?.commands.fetch();
};

export const findCommand = (
  name: string,
  commands:
    | Collection<
      string,
      ApplicationCommand<{
        guild: GuildResolvable;
      }>
    >
    | undefined,
) => {
  return commands?.find((command) => command.name === name);
};

export const findSubcommand = (
  cmdName: string,
  subName: string,
  commands: Collection<
    string,
    ApplicationCommand<{
      guild: GuildResolvable;
    }>
  >,
) => {
  const command = commands.find(({ name }) => name === cmdName);
  return command?.options.find(
    ({ type, name }) => type === ApplicationCommandOptionType.Subcommand && name === subName,
  );
};

export const encryptMessage = (string: string, key: Buffer) => {
  const iv: Buffer = randomBytes(16); // Initialization vector
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(string, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};
