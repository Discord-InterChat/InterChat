import logger from '../logger';
import discord from 'discord.js';
import { Api } from '@top-gg/sdk';
import { prisma } from '../db';
import 'dotenv/config';
// eslint-disable-next-line
// @ts-ignore
import _ from 'lodash/string';
import { badge, normal } from '../JSON/emoji.json';
import { stripIndents } from 'common-tags';

export function toTitleCase(txt: string) {
  return _.startCase(_.toLower(txt));
}

export function getGuildName(client: discord.Client, gid: string | null) {
  if (!gid) return '';
  return client.guilds.cache.get(gid)?.name;
}

/** Random color generator for embeds */
export function colors(type: 'random' | 'christmas' | 'chatbot' | 'invisible' = 'random') {
  const colorType = {
    random: [
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
    christmas: ['#00B32C', '#D6001C', '#FFFFFF'] as discord.HexColorString[],
    chatbot: '#5CB5F9' as discord.HexColorString,
    invisible: '#2F3136' as discord.HexColorString,
  };

  // return the color type or a random color from the list
  return type === 'christmas' ? choice(colorType.christmas) : type === 'random' ? choice(colorType.random) : colorType[type];
}
/** Returns random color (resolved) from choice of Discord.JS default color string */
export function choice(arr: discord.ColorResolvable[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Send a message to a guild */
export async function sendInFirst(guild: discord.Guild, message: string | discord.MessagePayload | discord.BaseMessageOptions) {
  const channels = await guild.channels.fetch();

  const channel = channels
    .filter((chn) => chn?.isTextBased() && chn.permissionsFor(guild.members.me as discord.GuildMember).has('SendMessages'))
    .first();

  if (channel?.isTextBased()) await channel.send(message).catch((e) => !e.message.includes('Missing Access') || !e.message.includes('Missing Permissions') ? logger.error(e) : null);
  return;
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
  return prisma;
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
 * @param client Discord.JS client
 * @param user The user to check
 * @param onlyDeveloper Only check if user is a developer
 */
export async function checkIfStaff(user: discord.GuildMember | discord.User, onlyDeveloper = false) {
  try {
    const staffRole = '800698916995203104';
    const developerRole = '770256273488347176';

    const allowedRoles = [staffRole, developerRole];

    const guild = await user.client.guilds.fetch('770256165300338709');
    const member = await guild.members.fetch(user);
    const roles = member.roles.cache;

    const isStaff = roles?.hasAny(...allowedRoles);
    const isDev = roles?.has(developerRole);

    if (onlyDeveloper && !isDev) return false;
    else if (isStaff) return true;
    return false;
  }
  catch {
    return false;
  }
}

// TODO: This is sooo outdated, but works for now
/** Delete channels from databse that chatbot doesn't have access to.*/
export async function deleteChannels(client: discord.Client) {
  const channels = await prisma.connectedList.findMany();

  const unknownChannels = [];
  for (let i = 0; i < channels?.length; i++) {
    const element = channels[i];
    try {
      await client.channels.fetch(element.channelId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
      if (err.message === 'Unknown Channel') {
        unknownChannels.push(element.channelId);
        continue;
      }
    }
  }

  if (unknownChannels.length > 0) {
    const deletedChannels = await prisma.connectedList.deleteMany({
      where: {
        channelId: {
          in: unknownChannels,
        },
      },
    });
    logger.info(`Deleted ${deletedChannels.count} channels from the connectedList database.`);
    return;
  }
}

export function badgeToEmoji(badgeArr: string[]) {
  let badgeString = '';
  const tempbadge: { [key: string]: string } = badge;

  badgeArr.forEach((badgeName) => {
    if (badgeName in tempbadge) badgeString += tempbadge[badgeName];
  });
  return badgeString || null;
}

export const topgg = new Api(process.env.TOPGG as string);
export const rulesEmbed = new discord.EmbedBuilder()
  .setTitle(`${normal.clipart} Network Rules`)
  .setColor(colors('chatbot'))
  .setImage('https://i.imgur.com/D2pYagc.png')
  .setDescription(stripIndents`
    1. No spamming or flooding.
    3. Advertising of any kind is prohibited.
    4. Private matters should not be discussed in the network.
    5. Do not make the chat uncomfortable for other users.
    6. Using slurs is not allowed on the network.
    7. Refrain from using bot commands in the network.
    8. Trolling, insulting, and profanity is not allowed.
    9. Posting explicit or NSFW content will result in an immediate blacklist.
    10. Trivialization of sensitive topics such as self-harm, suicide and others which may cause offense to other members is prohibited.
    11. Do not attempt to get around the Profanity Filter.
    *If you have any questions, please join the [support server](https://discord.gg/6bhXQynAPs).*`,
  );

export const constants = {
  developers: ['828492978716409856', '701727675311587358', '456961943505338369'],
  staff: ['597265261665714186', '442653948630007808'],
  guilds: { cbhq: '770256165300338709' },

  channel: {
    bugs: '1035135196053393418',
    networklogs: '1002864642101624832',
    errorlogs: '1024313459187404830',
    modlogs: '1042265633896796231',
    reports: '821610981155012628',
    goal: '906460473065615403',
    suggestions: '1021256657528954900',
    reviews: '1002874342343970946',
  },
} as const;
