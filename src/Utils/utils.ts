import startCase from 'lodash/startCase';
import toLower from 'lodash/toLower';
import logger from './logger';
import discord from 'discord.js';
import { Api } from '@top-gg/sdk';
import { badge } from './JSON/emoji.json';
import { stripIndents } from 'common-tags';
import { PrismaClient } from '@prisma/client';
import { hubs } from '@prisma/client';
import 'dotenv/config';

export const constants = {
  developers: ['828492978716409856', '701727675311587358', '456961943505338369'],
  staff: ['597265261665714186', '442653948630007808', '689082827979227160'],
  guilds: { cbhq: '770256165300338709' },

  channel: {
    bugs: '1035135196053393418',
    networklogs: '1156144879869632553',
    modlogs: '1042265633896796231',
    reports: '1158773603551162398',
    goal: '906460473065615403',
    suggestions: '1021256657528954900',
  },
  colors: {
    all: [
      'Default',
      'White',
      'Aqua',
      'Green',
      'Blue',
      'Yellow',
      'Purple',
      'LuminousVividPink',
      'Fuchsia',
      'Gold',
      'Orange',
      'Red',
      'Grey',
      'DarkNavy',
      'DarkAqua',
      'DarkGreen',
      'DarkBlue',
      'DarkPurple',
      'DarkVividPink',
      'DarkGold',
      'DarkOrange',
      'DarkRed',
      'DarkGrey',
      'DarkerGrey',
      'LightGrey',
      'DarkNavy',
      'Blurple',
      'Greyple',
      'DarkButNotBlack',
      'NotQuiteBlack',
      'Random',
    ] as (keyof typeof discord.Colors)[],
    interchatBlue: '#5CB5F9' as discord.HexColorString,
    invisible: '#2F3136' as discord.HexColorString,
    christmas:['#00B32C', '#D6001C', '#FFFFFF'] as discord.HexColorString[],
  },
} as const;

export const topgg = new Api(process.env.TOPGG as string);
const _prisma = new PrismaClient();

export const rulesEmbed = new discord.EmbedBuilder()
  .setColor(constants.colors.interchatBlue)
  .setImage('https://i.imgur.com/D2pYagc.png')
  .setDescription(stripIndents`
  ### 📜 InterChat Network Rules

  1. **Use Common Sense:** Be considerate of others and their views. No slurs, derogatory language or any actions that can disrupt the chat's comfort.
  2. **No Spamming or Flooding:** Avoid repeated, nonsensical, or overly lengthy messages.
  3. **Keep Private Matters Private:** Avoid sharing personal information across the network.
  4. **No Harassment:** Trolling, insults, or harassment of any kind are not tolerated.
  5. **No NSFW/NSFL Content:** Posting explicit NSFW/NSFL content will result in immediate blacklist.
  6. **Respect Sensitive Topics:** Do not trivialize self-harm, suicide, violence, or other offensive topics.
  7. **Report Concerns:**  If you observe a violation of these rules, report it to the appropriate hub moderator or InterChat staff for further action.

  Any questions? Join our [support server](https://discord.gg/6bhXQynAPs).
  `,
  );

export function replaceLinks(string: string, replaceText = '`[LINK HIDDEN]`') {
  const urlRegex = /https?:\/\/(?!tenor\.com|giphy\.com)\S+/g;
  return string.replaceAll(urlRegex, replaceText);
}

export function yesOrNoEmoji(option: unknown, yesEmoji: string, noEmoji: string) {
  return option ? yesEmoji : noEmoji;
}

export function toTitleCase(txt: string): string {
  return startCase(toLower(txt));
}

export async function getHubName(hubId: string) {
  return (await getDb().hubs.findUnique({ where: { id: hubId } }))?.name;
}

export function getGuildName(client: discord.Client, gid: string | null) {
  if (!gid) return '';
  return client.guilds.cache.get(gid)?.name;
}

/** Return a random element from an array */
export function choice<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Send a message to the first text based channel in a guild */
export async function sendInFirst(guild: discord.Guild, message: string | discord.MessagePayload | discord.BaseMessageOptions) {
  const channels = await guild.channels.fetch();

  const channel = channels.find(chn =>
    chn?.isTextBased() &&
    chn.permissionsFor(guild.members.me as discord.GuildMember).has('SendMessages')) as discord.GuildTextBasedChannel | null | undefined;

  await channel?.send(message).catch((e) => !e.message.includes('Missing Access') || !e.message.includes('Missing Permissions') ? logger.error(e) : null);
}

export async function getCredits() {
  let creditArray: string[] = [];

  creditArray = creditArray.concat(
    constants.developers,
    constants.staff,
  );

  // Exiryn (Mascot Artist)
  creditArray.push('880978672037802014');

  return creditArray;
}

/** Use the main database in your code by calling this function */
export function getDb() {
  return _prisma;
}

/** Convert milliseconds to a human readable time (eg: 1d 2h 3m 4s) */
export function toHuman(milliseconds: number): string {
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
}

/**
 * Checks if a user is a InterChat Staff or Developer
 * @param onlyDeveloper Only check if user is a developer
 */
export function checkIfStaff(userId: string, onlyDeveloper = false) {
  const isStaff = constants.staff.find((uId) => uId == userId);
  const isDev = constants.developers.find((uId) => uId == userId);

  if (onlyDeveloper && !isDev) return false;
  else if (isStaff || isDev) return true;
  return false;
}

export function badgeToEmoji(badgeArr: string[]) {
  const badgeEmojis: string[] = [];
  const tempbadge: { [key: string]: string } = badge;

  badgeArr.forEach((badgeName) => {
    if (badgeName in tempbadge) badgeEmojis.push(tempbadge[badgeName]);
  });
  return badgeEmojis;
}

export function calculateAverageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;

  const sum = ratings.reduce((acc, cur) => acc + cur, 0);
  const average = sum / ratings.length;
  return Math.round(average * 10) / 10;
}

interface HubListingExtraInput {
  connections?: number;
}

export function createHubListingsEmbed(hub: hubs, extra?: HubListingExtraInput) {
  return new discord.EmbedBuilder()
    .setDescription(stripIndents`
      ### ${hub.name}
      ${hub.description}

      **Rating:** ${hub.rating?.length > 0 ? '⭐'.repeat(calculateAverageRating(hub.rating.map(hr => hr.rating))) : '-'}
      **Connections:** ${extra?.connections ?? 'Unknown.'}
      **Created At:** <t:${Math.round(hub.createdAt.getTime() / 1000)}:d>
    `)
    .setColor('Random')
    .setThumbnail(hub.iconUrl)
    .setImage(hub.bannerUrl);
}


export async function deleteHubs(ids: string[]) {
  // delete all relations first and then delete the hub
  await _prisma.connectedList.deleteMany({ where: { hubId: { in: ids } } });
  await _prisma.hubInvites.deleteMany({ where: { hubId: { in: ids } } });
  await _prisma.messageData.deleteMany({ where: { hubId: { in: ids } } });
  await _prisma.hubs.deleteMany({ where: { id: { in: ids } } });
}

export async function getOrCreateWebhook(channel: discord.TextChannel | discord.ThreadChannel, avatar: string | null) {
  const channelOrParent = channel.type === discord.ChannelType.GuildText ? channel : channel.parent;
  const webhooks = await channelOrParent?.fetchWebhooks();
  const existingWebhook = webhooks?.find((w) => w.owner?.id === channel.client.user?.id);

  if (existingWebhook) {
    return existingWebhook;
  }

  return await channelOrParent?.createWebhook({
    name: 'InterChat Network',
    avatar,
  });
}

