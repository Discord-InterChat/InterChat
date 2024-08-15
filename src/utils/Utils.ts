import { hubs } from '@prisma/client';
import { captureException } from '@sentry/node';
import { createCipheriv, randomBytes } from 'crypto';
import { ClusterManager } from 'discord-hybrid-sharding';
import {
  ActionRow,
  ActionRowBuilder,
  ApplicationCommand,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Collection,
  ColorResolvable,
  CommandInteraction,
  ComponentType,
  EmbedBuilder,
  ForumChannel,
  GuildResolvable,
  Interaction,
  MediaChannel,
  Message,
  MessageActionRowComponent,
  MessageComponentInteraction,
  messageLink,
  NewsChannel,
  RepliableInteraction,
  Snowflake,
  TextChannel,
  ThreadChannel,
  WebhookClient,
  WebhookMessageCreateOptions,
} from 'discord.js';
import 'dotenv/config';
import startCase from 'lodash/startCase.js';
import toLower from 'lodash/toLower.js';
import Scheduler from '#main/modules/SchedulerService.js';
import { RemoveMethods } from '../typings/index.js';
import { deleteConnection, deleteConnections } from './ConnectedList.js';
import {
  colors,
  DeveloperIds,
  emojis,
  LINKS,
  REGEX,
  StaffIds,
  SUPPORT_SERVER_ID,
  SupporterIds,
} from './Constants.js';
import { CustomID } from './CustomID.js';
import db from './Db.js';
import { supportedLocaleCodes, t } from './Locale.js';
import Logger from './Logger.js';

export const resolveEval = <T>(value: T[]) =>
  value?.find((res) => Boolean(res)) as RemoveMethods<T> | undefined;

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

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sort the array based on the reaction counts.
 * ### Eg:
 * **Before:**
 * ```ts
 *  { '👍': ['10201930193'], '👎': ['10201930193', '10201930194'] }
 * ```
 * **After:**
 * ```ts
 * [ [ '👎', ['10201930193', '10201930194'] ], [ '👍', ['10201930193'] ] ]
 * ```
 * */
export const sortReactions = (reactions: { [key: string]: string[] }): [string, string[]][] =>
  Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);

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

export const yesOrNoEmoji = (option: unknown, yesEmoji: string, noEmoji: string) =>
  option ? yesEmoji : noEmoji;

export const disableComponents = (message: Message) =>
  message.components.flatMap((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => (component.disabled = true));
    return jsonRow;
  });

const createWebhook = async (
  channel: NewsChannel | TextChannel | ForumChannel | MediaChannel,
  avatar: string,
) =>
  await channel
    ?.createWebhook({
      name: 'InterChat Network',
      avatar,
    })
    .catch(() => undefined);

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

export const getCredits = () => [...DeveloperIds, ...StaffIds, ...SupporterIds];

export const checkIfStaff = (userId: string, onlyCheckForDev = false) => {
  const staffMembers = [...DeveloperIds, ...(onlyCheckForDev ? [] : StaffIds)];
  return staffMembers.includes(userId);
};

export const disableAllComponents = (
  components: ActionRow<MessageActionRowComponent>[],
  disableLinks = false,
) =>
  components.map((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => {
      if (
        !disableLinks &&
        component.type === ComponentType.Button &&
        component.style === ButtonStyle.Link // leave link buttons enabled
      ) {
        component.disabled = false;
      }
      else {
        component.disabled = true;
      }
    });
    return jsonRow;
  });

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

export const replaceLinks = (string: string, replaceText = '`[LINK HIDDEN]`') =>
  string.replaceAll(REGEX.LINKS, replaceText);

export const simpleEmbed = (
  description: string,
  opts?: { color?: ColorResolvable; title?: string },
) =>
  new EmbedBuilder()
    .setTitle(opts?.title ?? null)
    .setColor(opts?.color ?? colors.invisible)
    .setDescription(description.toString());

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

export const toTitleCase = (str: string) => startCase(toLower(str));

export const channelMention = (channelId: Snowflake | null | undefined) => {
  if (!channelId) return emojis.no;
  return `<#${channelId}>`;
};

const genCommandErrMsg = (locale: supportedLocaleCodes, errorId: string) =>
  t(
    { phrase: 'errors.commandError', locale },
    { errorId, emoji: emojis.no, support_invite: LINKS.SUPPORT_INVITE },
  );

export const getReplyMethod = (
  interaction: RepliableInteraction | CommandInteraction | MessageComponentInteraction,
) => (interaction.replied || interaction.deferred ? 'followUp' : 'reply');

/**
    Invoke this method to handle errors that occur during command execution.
    It will send an error message to the user and log the error to the system.
  */
export const sendErrorEmbed = async (interaction: RepliableInteraction, errorId: string) => {
  const method = getReplyMethod(interaction);
  const { userManager } = interaction.client;
  const locale = await userManager.getUserLocale(interaction.user.id);

  // reply with an error message if the command failed
  return await interaction[method]({
    embeds: [simpleEmbed(genCommandErrMsg(locale, errorId))],
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

export const isDev = (userId: Snowflake) => DeveloperIds.includes(userId);

export const escapeRegexChars = (input: string): string =>
  input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

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
    guildId = SUPPORT_SERVER_ID,
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

export const fetchHub = async (id: string) => await db.hubs.findFirst({ where: { id } });

export const containsInviteLinks = (str: string) => {
  const inviteLinks = ['discord.gg', 'discord.com/invite', 'dsc.gg'];
  return inviteLinks.some((link) => str.includes(link));
};

export const fetchCommands = async (client: Client) => await client.application?.commands.fetch();

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
) => commands?.find((command) => command.name === name);

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

export const getTagOrUsername = (username: string, discrim: string) =>
  discrim !== '0' ? `${username}#${discrim}` : username;

export const isHubMod = (userId: string, hub: hubs) =>
  Boolean(hub.ownerId === userId || hub.moderators.find((mod) => mod.userId === userId));

export const isStaffOrHubMod = (userId: string, hub: hubs) =>
  checkIfStaff(userId) || isHubMod(userId, hub);

export const isHumanMessage = (message: Message) =>
  !message.author.bot && !message.system && !message.webhookId;

export const greyOutButton = (row: ActionRowBuilder<ButtonBuilder>, disableElement: number) => {
  row.components.forEach((c) => c.setDisabled(false));
  row.components[disableElement].setDisabled(true);
};
export const greyOutButtons = (rows: ActionRowBuilder<ButtonBuilder>[]) => {
  rows.forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
};


export const generateJumpButton = (
  referredAuthorUsername: string,
  opts: { messageId: Snowflake; channelId: Snowflake; serverId: Snowflake },
) =>
  // create a jump to reply button
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(emojis.reply)
      .setURL(messageLink(opts.channelId, opts.messageId, opts.serverId))
      .setLabel(
        referredAuthorUsername.length >= 80
          ? `@${referredAuthorUsername.slice(0, 76)}...`
          : `@${referredAuthorUsername}`,
      ),
  );
