import type { Colors, HexColorString, Snowflake } from 'discord.js';
import { createRequire } from 'module';
import type jsonEmotes from './emojis.json';
import type badwordsType from './profanity.json';

// create a require as ESM doesn't support importing JSON
const require = createRequire(import.meta.url);
export const { slurs, profanity } = require('./profanity.json') as typeof badwordsType;
export const {
  normal: emojis,
  mascot: mascotEmojis,
  badge: badgeEmojis,
} = require('./emojis.json') as typeof jsonEmotes;

export const enum RedisKeys {
  msgTimestamp = 'msgTimestamp',
  lastActive = 'lastActive',
  connectionHubId = 'connectionHubId',
  hubConnections = 'hubConnections',
  userData = 'UserData',
  cooldown = 'cooldown',
  blacklistedServers = 'blacklistedServers',
  channelQueue = 'channelQueue',
  commandUsesLeft = 'commandUsesLeft',
  msgDeleteInProgress = 'msgDeleteInProgress',
  userInfraction = 'UserInfraction',
  serverInfraction = 'ServerInfraction',
  hubLogConfig = 'hubLogConfig',
  message = 'message',
  broadcasts = 'broadcasts',
  messageReverse = 'messageReverse',
}

export const enum ConnectionMode {
  Compact = 0,
  Embed = 1,
}

/** Unicode emojis for numbers */
export const numberEmojis = [
  '0️⃣',
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
] as const;

export default {
  isDevBuild: process.env.NODE_ENV === 'development',

  StaffIds: ['442653948630007808', '885241933927161896', '597265261665714186'] as Snowflake[],
  DeveloperIds: ['828492978716409856', '701727675311587358', '456961943505338369'] as Snowflake[],
  SupporterIds: ['880978672037802014'] as Snowflake[],

  ProjectVersion: require('../../package.json').version ?? 'Unknown',
  SupportServerId: '770256165300338709',
  VoterRoleId: '985153241727770655',

  // Regexp
  Regex: {
    ImageURL: /\bhttps?:\/\/\S+?\.(?:png|jpe?g|gif)(?:\?\S+)?\b/,
    /** no animated images */
    StaticImageUrl: /\bhttps?:\/\/\S+?\.(?:png|jpe?g|webp)(?:\?\S+)?\b/,
    /** ignores giphy and tenor */
    Links: /https?:\/\/(?!tenor\.com|giphy\.com)\S+/g,
    /** matches profanity words */
    Profanity: new RegExp(profanity.map((word) => `\\b${word}\\b`).join('|'), 'gi'),
    /** matches slurs */
    Slurs: new RegExp(slurs.map((word) => `\\b${word}\\b`).join('|'), 'gi'),
    TenorLinks: /https:\/\/tenor\.com\/view\/.*-(\d+)/,
    Emoji: /<(a)?:([a-zA-Z0-9_]+):(\d+)>/,
    BannedWebhookWords: /discord|clyde|```/gi,
    SpecialCharacters: /[^a-zA-Z0-9|$|@]|\^/g,
    MatchWord: /\w/g,
    SplitWords: /\b/,
    Hexcode: /^#[0-9A-F]{6}$/i,
    ChannelMention: /<#|!|>/g,
    ImgurImage: /https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.((jpg)|(jpeg)|(png)|(gif))/g,
  },

  Links: {
    TopggApi: 'https://top.gg/api/bots/769921109209907241',
    Vote: 'https://top.gg/bot/769921109209907241/vote',
    Docs: 'https://docs.interchat.fun',
    SupportInvite: 'https://discord.gg/8DhUA4HNpD',
    AppDirectory: 'https://discord.com/application-directory/769921109209907241',
    RulesBanner: 'https://i.imgur.com/MBG0Rks.png',
    EasterAvatar: 'https://i.imgur.com/80nqtSg.png',
  },

  Channels: {
    devChat: '770488420521738250',
    networklogs: '1156144879869632553',
    modlogs: '1042265633896796231',
    reports: '1158773603551162398',
    goal: '906460473065615403',
    suggestions: '1021256657528954900',
    inviteLogs: '1246117516099457146',
  },

  Colors: {
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
    ] as (keyof typeof Colors)[],
    interchatBlue: '#58b9ff' as HexColorString,
    invisible: '#2b2d31' as HexColorString,
    christmas: ['#00B32C', '#D6001C', '#FFFFFF'] as HexColorString[],
  },
} as const;
