import db from './Db.js';
import Logger from './Logger.js';
import toLower from 'lodash/toLower.js';
import Scheduler from '../services/SchedulerService.js';
import startCase from 'lodash/startCase.js';
import {
  ActionRow,
  ButtonStyle,
  ChannelType,
  ColorResolvable,
  ComponentType,
  EmbedBuilder,
  ForumChannel,
  Interaction,
  MediaChannel,
  Message,
  MessageActionRowComponent,
  NewsChannel,
  RepliableInteraction,
  Snowflake,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import { DeveloperIds, REGEX, StaffIds, SupporterIds, LINKS, colors, emojis } from './Constants.js';
import { randomBytes } from 'crypto';
import { t } from './Locale.js';
import 'dotenv/config';
import { captureException } from '@sentry/node';
import { CustomID } from './CustomID.js';

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

  if (days == 0 && hours == 0 && minutes == 0) readable = `${seconds} seconds`;
  else if (days == 0 && hours == 0) readable = `${minutes}m ${seconds}s`;
  else if (days == 0) readable = `${hours}h, ${minutes}m ${seconds}s`;
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

  const res = await (
    await fetch(`${LINKS.TOPGG_API}/check?userId=${userId}`, {
      method: 'GET',
      headers: {
        Authorization: process.env.TOPGG_API_KEY,
      },
    })
  ).json();

  return !!res.voted;
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

export const getOrCreateWebhook = async (
  channel: NewsChannel | TextChannel | ThreadChannel,
  avatar = LINKS.EASTER_AVATAR,
) => {
  const channelOrParent =
    channel.type === ChannelType.GuildText || channel.type == ChannelType.GuildAnnouncement
      ? channel
      : channel.parent;

  if (!channelOrParent) return;

  const existingWebhook = await findExistingWebhook(channelOrParent);

  if (existingWebhook) return existingWebhook;
  return await createWebhook(channelOrParent, avatar);
};

const findExistingWebhook = async (
  channel: NewsChannel | TextChannel | ForumChannel | MediaChannel,
) => {
  const webhooks = await channel?.fetchWebhooks().catch(() => null);
  return webhooks?.find((w) => w.owner?.id === channel.client.user?.id);
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

export const getCredits = () => {
  return [...DeveloperIds, ...StaffIds, ...SupporterIds];
};

export const checkIfStaff = (userId: string, onlyCheckForDev = false) => {
  const staffMembers = [...DeveloperIds, ...(onlyCheckForDev ? [] : StaffIds)];

  if (staffMembers.includes(userId)) return true;
  return false;
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

export const deleteHubs = async (ids: string[]) => {
  // delete all relations first and then delete the hub
  await db.connectedList.deleteMany({ where: { hubId: { in: ids } } });
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

export const simpleEmbed = (description: string, color: ColorResolvable = colors.invisible) => {
  return new EmbedBuilder().setColor(color).setDescription(description.toString());
};

export const calculateAverageRating = (ratings: number[]): number => {
  if (ratings.length === 0) return 0;

  const sum = ratings.reduce((acc, cur) => acc + cur, 0);
  const average = sum / ratings.length;
  return Math.round(average * 10) / 10;
};

export const checkAndFetchImgurUrl = async (url: string): Promise<string | false> => {
  const regex = REGEX.IMGUR_LINKS;
  const match = url.match(regex);

  if (!match || !match[1]) return false;

  const type = match[0].includes('/a/') || match[0].includes('/gallery/') ? 'gallery' : 'image';

  const response = await fetch(`https://api.imgur.com/3/${type}/${match[1]}`, {
    headers: {
      Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
    },
  });
  const data = await response.json().catch(() => null);
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

const genCommandErrMsg = (locale: string, error: string) => {
  return t(
    { phrase: 'errors.commandError', locale },
    { error, emoji: emojis.no, support_invite: LINKS.SUPPORT_INVITE },
  );
};

/**
    Invoke this method to handle errors that occur during command execution.
    It will send an error message to the user and log the error to the system.
  */
export const replyWithError = async (interaction: RepliableInteraction, e: string) => {
  const method = interaction.replied || interaction.deferred ? 'followUp' : 'reply';

  // reply with an error message if the command failed
  return await interaction[method]({
    embeds: [simpleEmbed(genCommandErrMsg(interaction.user.locale || 'en', e))],
    ephemeral: true,
  }).catch(() => null);
};

/**
 * Parses the timestamp from a Snowflake ID and returns it in milliseconds.
 * @param id The Snowflake ID to parse.
 * @returns The timestamp in milliseconds.
 */
export const parseTimestampFromId = (id: Snowflake) => {
  // Convert ID to binary
  const binaryId = BigInt(id).toString(2);

  // Extract timestamp bits
  const timestampBits = binaryId.substring(0, binaryId.length - 22);

  // Convert timestamp to milliseconds
  const timestamp = parseInt(timestampBits, 2);

  return timestamp + 1420070400000; // Discord epoch time
};

export const deleteMsgsFromDb = async (ids: string[]) => {
  // delete all relations first and then delete the hub
  const msgsToDelete = await db.broadcastedMessages.findMany({ where: { messageId: { in: ids } } });
  if (!msgsToDelete) return;

  await db.broadcastedMessages.deleteMany({
    where: { messageId: { in: msgsToDelete.map(({ messageId }) => messageId) } },
  });
  await db.originalMessages.deleteMany({
    where: { messageId: { in: msgsToDelete.map(({ originalMsgId }) => originalMsgId) } },
  });
};

export const channelMention = (channelId: Snowflake | null | undefined) => {
  if (!channelId) return emojis.no;
  return `<#${channelId}>`;
};

export const handleError = (e: Error, interaction?: Interaction) => {
  // log the error to the system
  Logger.error(e);
  let extra;

  if (interaction) {
    extra = {
      user: { id: interaction.user.id, username: interaction.user.username },
      extra: {
        type: interaction.type,
        identifier:
          interaction.isCommand() || interaction.isAutocomplete()
            ? interaction.commandName
            : CustomID.parseCustomId(interaction.customId),
      },
    };
  }

  // capture the error to Sentry.io with additional information
  captureException(e, extra);

  // reply with an error message to the user
  if (interaction?.isRepliable()) replyWithError(interaction, String(e));
};

export const isDev = (userId: Snowflake) => {
  return DeveloperIds.includes(userId);
};
