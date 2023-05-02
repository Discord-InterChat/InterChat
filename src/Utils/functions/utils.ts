import startCase from 'lodash/startCase';
import toLower from 'lodash/toLower';
import logger from '../logger';
import discord from 'discord.js';
import { Api } from '@top-gg/sdk';
import { prisma } from '../db';
import { badge, normal } from '../JSON/emoji.json';
import { stripIndents } from 'common-tags';
import { scheduleJob } from 'node-schedule';
import { modActions } from '../../Scripts/networkLogs/modActions';
import 'dotenv/config';

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
    hubReviews: '1102625912274550884',
  },
  colors: {
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
    chatbot: '#5CB5F9' as discord.HexColorString,
    invisible: '#2F3136' as discord.HexColorString,
    christmas:['#00B32C', '#D6001C', '#FFFFFF'] as discord.HexColorString[],
  },
} as const;

export const topgg = new Api(process.env.TOPGG as string);


export function toTitleCase(txt: string): string {
  return startCase(toLower(txt));
}

export function getGuildName(client: discord.Client, gid: string | null) {
  if (!gid) return '';
  return client.guilds.cache.get(gid)?.name;
}

/** Random color generator for embeds */
export function colors(type: keyof typeof constants.colors = 'random') {
  return type === 'christmas' || type === 'random' ? choice(constants.colors[type]) : constants.colors[type] ;
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

  if (days == 0 && hours == 0 && minutes == 0) readable = `${seconds} seconds `;
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

export function badgeToEmoji(badgeArr: string[]) {
  const badgeEmojis: string[] = [];
  const tempbadge: { [key: string]: string } = badge;

  badgeArr.forEach((badgeName) => {
    if (badgeName in tempbadge) badgeEmojis.push(tempbadge[badgeName]);
  });
  return badgeEmojis;
}

export async function addUserBlacklist(moderator: discord.User, user: discord.User | string, reason: string, expires?: Date | number, notifyUser = true) {
  if (typeof user === 'string') user = await moderator.client.users.fetch(user);
  if (typeof expires === 'number') expires = new Date(Date.now() + expires);

  const dbUser = await prisma.blacklistedUsers.create({
    data: {
      reason,
      userId: user.id,
      username: user.username,
      notified: true,
      expires,
    },
  });

  // Send action to logs channel
  modActions(moderator, {
    user,
    action: 'blacklistUser',
    expires,
    reason,
  }).catch(() => null);

  if (notifyUser) {
    const emotes = user.client.emotes.normal;
    const expireString = expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never';
    const embed = new discord.EmbedBuilder()
      .setTitle(emotes.blobFastBan + ' Blacklist Notification')
      .setDescription('You have been muted from talking in the network.')
      .setColor(colors('chatbot'))
      .setFields(
        { name: 'Reason', value: String(reason), inline: true },
        { name: 'Expires', value: expireString, inline: true },
      )
      .setFooter({ text: 'Join the support server to appeal the blacklist.' });

    user.send({ embeds: [embed] }).catch(async () => {
      await prisma.blacklistedUsers.update({ where: { userId: (user as discord.User).id }, data: { notified: false } });
      logger.info(`Could not notify ${(user as discord.User).tag} about their blacklist.`);
    });
  }

  // set an unblacklist timer if there is an expire duration
  if (expires) {
    scheduleJob(`blacklist_user-${user.id}`, expires, async () => {
      const tempUser = user as discord.User;
      const filter = { where: { userId: tempUser.id } };

      // only call .delete if the document exists
      // or prisma will error
      if (await prisma.blacklistedUsers.findFirst(filter)) {
        await prisma.blacklistedUsers.delete(filter);
        modActions(tempUser.client.user, {
          user: tempUser,
          action: 'unblacklistUser',
          blacklistReason: dbUser.reason,
          reason: 'Blacklist expired for user.',
        }).catch(() => null);
      }
    });
  }
  return dbUser;
}


export async function addServerBlacklist(moderator: discord.User, guild: discord.Guild | string, reason: string, expires?: Date) {
  if (typeof guild === 'string') guild = await moderator.client.guilds.fetch(guild);

  const dbGuild = await prisma.blacklistedServers.create({
    data: {
      reason,
      serverId: guild.id,
      serverName: guild.name,
      expires,
    },
  });

  // Send action to logs channel
  modActions(moderator, {
    guild: { id: guild.id, resolved: guild },
    action: 'blacklistServer',
    expires,
    reason,
  }).catch(() => null);

  // set an unblacklist timer if there is an expire duration
  if (expires) {
    scheduleJob(`blacklist_server-${guild.id}`, expires, async () => {
      const tempGuild = guild as discord.Guild;
      const filter = { where: { serverId: tempGuild.id } };

      // only call .delete if the document exists
      // or prisma will error
      if (await prisma.blacklistedServers.findFirst(filter)) {
        await prisma.blacklistedServers.delete(filter);
        modActions(tempGuild.client.user, {
          dbGuild,
          action: 'unblacklistServer',
          timestamp: new Date(),
          reason: 'Blacklist expired for server.',
        }).catch(() => null);
      }
    });
  }
  return dbGuild;
}

export const rulesEmbed = new discord.EmbedBuilder()
  .setTitle(`${normal.clipart} Network Rules`)
  .setColor(colors('chatbot'))
  .setImage('https://i.imgur.com/D2pYagc.png')
  .setDescription(stripIndents`
    1. No spamming or flooding.
    2. Use only **English** while using the network. 
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
