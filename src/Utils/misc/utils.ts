import startCase from 'lodash/startCase';
import toLower from 'lodash/toLower';
import emojis from '../../Utils/JSON/emoji.json';
import logger from '../logger';
import discord from 'discord.js';
import { Api } from '@top-gg/sdk';
import { badge, normal } from '../JSON/emoji.json';
import { stripIndents } from 'common-tags';
import { scheduleJob } from 'node-schedule';
import { modActions } from '../../Scripts/networkLogs/modActions';
import { PrismaClient } from '@prisma/client';
import { hubs } from '@prisma/client';
import 'dotenv/config';

export const constants = {
  developers: ['828492978716409856', '701727675311587358', '456961943505338369'],
  staff: ['597265261665714186', '442653948630007808', '689082827979227160'],
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

export async function addUserBlacklist(hubId: string, moderator: discord.User, user: discord.User | string, reason: string, expires?: Date | number, notifyUser = true) {
  if (typeof user === 'string') user = await moderator.client.users.fetch(user);
  if (typeof expires === 'number') expires = new Date(Date.now() + expires);

  const dbUser = await _prisma.blacklistedUsers.create({
    data: {
      hub: { connect: { id: hubId } },
      userId: user.id,
      username: user.username,
      notified: notifyUser,
      expires,
      reason,
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
    const hub = await _prisma.hubs.findUnique({ where: { id: hubId } });
    const expireString = expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never';
    const embed = new discord.EmbedBuilder()
      .setTitle(emojis.normal.blobFastBan + ' Blacklist Notification')
      .setDescription(`You have been banned from talking in hub **${hub?.name}**.`)
      .setColor(constants.colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    user.send({ embeds: [embed] }).catch(async () => {
      await _prisma.blacklistedUsers.update({ where: { userId: (user as discord.User).id }, data: { notified: false } });
      logger.info(`Could not notify ${(user as discord.User).username} about their blacklist.`);
    });
  }

  // set an unblacklist timer if there is an expire duration
  if (expires) {
    scheduleJob(`blacklist_user-${user.id}`, expires, async () => {
      const tempUser = user as discord.User;
      const filter = { where: { userId: tempUser.id } };

      // only call .delete if the document exists
      // or prisma will error
      if (await _prisma.blacklistedUsers.findFirst(filter)) {
        await _prisma.blacklistedUsers.delete(filter);
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


export async function addServerBlacklist(serverId: string, options: { moderator: discord.User, hubId: string, reason: string, expires?: Date }) {
  const guild = await options.moderator.client.guilds.fetch(serverId);

  const dbGuild = await _prisma.blacklistedServers.create({
    data: {
      hub: { connect: { id: options.hubId } },
      reason: options.reason,
      serverId: guild.id,
      serverName: guild.name,
      expires: options.expires,
    },
  });

  // Send action to logs channel
  modActions(options.moderator, {
    guild: { id: guild.id, resolved: guild },
    action: 'blacklistServer',
    expires: options.expires,
    reason: options.reason,
  }).catch(() => null);

  // set an unblacklist timer if there is an expire duration
  if (options.expires) {
    scheduleJob(`blacklist_server-${guild.id}`, options.expires, async () => {
      const filter = { where: { hubId: options.hubId, serverId: guild.id } };

      // only call .delete if the document exists
      // or prisma will error
      if (await _prisma.blacklistedServers.findFirst(filter)) {
        await _prisma.blacklistedServers.deleteMany(filter);
        modActions(guild.client.user, {
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

export function calculateAverageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;

  const sum = ratings.reduce((acc, cur) => acc + cur, 0);
  const average = sum / ratings.length;
  return Math.round(average * 10) / 10;
}

interface HubListingExtraInput {
  totalNetworks?: number;
}

export function createHubListingsEmbed(hub: hubs, extra?: HubListingExtraInput) {
  return new discord.EmbedBuilder()
    .setTitle(hub.name)
    .setDescription(hub.description)
    .setColor('Random')
    .setThumbnail(hub.iconUrl)
    .setImage(hub.bannerUrl)
    .addFields([
      {
        name: 'Tags',
        value: hub.tags.join(', '),
        inline: true,
      },
      {
        name: 'Rating',
        value: hub.rating?.length > 0
          ? '⭐'.repeat(calculateAverageRating(hub.rating.map(hr => hr.rating)))
          : '-',
        inline: true,
      },
      {
        name: 'Visibility',
        value: hub.private ? 'Private' : 'Public',
        inline: true,
      },
      {
        name: 'Networks',
        value: `${extra?.totalNetworks ?? 'Unknown.'}`,
        inline: true,
      },
      {
        name: 'Created At',
        value: `<t:${Math.round(hub.createdAt.getTime() / 1000)}>`,
        inline: true,
      },
    ]);
}


export async function deleteHubs(ids: string[]) {
  // delete all relations first and then delete the hub
  await _prisma.connectedList.deleteMany({ where: { hubId: { in: ids } } });
  await _prisma.hubInvites.deleteMany({ where: { hubId: { in: ids } } });
  await _prisma.messageData.deleteMany({ where: { hubId: { in: ids } } });
  await _prisma.hubs.deleteMany({ where: { id: { in: ids } } });
}

export const rulesEmbed = new discord.EmbedBuilder()
  .setTitle(`${normal.clipart} Network Rules`)
  .setColor(constants.colors.interchatBlue)
  .setImage('https://i.imgur.com/D2pYagc.png')
  .setDescription(stripIndents`
  # 📜 InterChat Network Rules
  1. **No Spamming or Flooding:**
   Avoid repeated, nonsensical, or overly lengthy messages.
  
  2. **English Only in Central Hub:**
   Use English for easy moderation. Non-native speakers may use a translator.
  
  3. **No Advertising:**
   No promotion of servers, social media, or other services.
  
  4. **Keep Private Matters Private:**
   Avoid sharing personal information across the network.
  
  5. **Maintain a Respectful Environment:**
   Be considerate of others and their views. No slurs, derogatory language or any actions that can disrupt the chat's comfort.
  
  6. **No Bot Commands:**
   Refrain from using bot commands that can be disruptive to other servers.
  
  7. **No Harassment:**
   Trolling, insults, or harassment of any kind are not tolerated.
  
  8. **No NSFW Content:**
   Posting explicit or NSFW content will result in immediate blacklist.
  
  9. **Respect Sensitive Topics:**
   Do not trivialize self-harm, suicide, violence, or other offensive topics.
  
  10. **Adhere to Chat Filters:**
   Evading InterChat's chat filters will not be tolerated.
  
  Any questions? Join our [support server](https://discord.gg/6bhXQynAPs).
  `,
  );
