import { Colors, HexColorString } from 'discord.js';
import { createRequire } from 'module';
import jsonEmotes from './JSON/emojis.json';
import badwordsType from './JSON/profanity.json';
import 'dotenv/config';

// create a require as ESM doesn't support importing JSON
const require = createRequire(import.meta.url);

export const { slurs, profanity } = require('./JSON/profanity.json') as typeof badwordsType;
export const {
  normal: emojis,
  mascot: mascotEmojis,
  badge: badgeEmojis,
} = require('./JSON/emojis.json') as typeof jsonEmotes;

export const isDevBuild = process.env.NODE_ENV === 'development';

export const PROJECT_VERSION = require('../../package.json').version ?? 'Unknown';
export const SUPPORT_SERVER_ID = '770256165300338709';
export const VOTER_ROLE_ID = '985153241727770655';

// Regexp
export const REGEX = {
  IMAGE_URL: /\bhttps?:\/\/\S+?\.(?:png|jpe?g|gif)(?:\?\S+)?\b/,
  /** no animated images */
  STATIC_IMAGE_URL: /\bhttps?:\/\/\S+?\.(?:png|jpe?g)(?:\?\S+)?\b/,
  /** ignores giphy and tenor */
  LINKS: /https?:\/\/(?!tenor\.com|giphy\.com)\S+/g,
  /** matches imgur urls */
  IMGUR_LINKS:
    /(?:https?:\/\/)?(?:www\.)?imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)(?:\.[a-zA-Z]+)?/i,
  /** matches profanity words */
  PROFANITY: new RegExp(profanity.map((word) => `\\b${word}\\b`).join('|'), 'gi'),
  /** matches slurs */
  SLURS: new RegExp(slurs.map((word) => `\\b${word}\\b`).join('|'), 'gi'),
  TENOR_LINKS: /https:\/\/tenor\.com\/view\/.*-(\d+)/,
  EMOJI: /<(a)?:([a-zA-Z0-9_]+):(\d+)>/,
  BANNED_WEBHOOK_WORDS: /discord|clyde|```/gi,
  SPECIAL_CHARACTERS: /[^a-zA-Z0-9|$|@]|\^/g,
  MATCH_WORD: /\w/g,
  SPLIT_WORDS: /\b/,
};

export const StaffIds = ['442653948630007808', '885241933927161896', '597265261665714186'];
export const DeveloperIds = ['828492978716409856', '701727675311587358', '456961943505338369'];
export const SupporterIds = ['880978672037802014'];

export const LINKS = {
  TOPGG_API: 'https://top.gg/api/bots/769921109209907241',
  VOTE: 'https://top.gg/bot/769921109209907241/vote',
  DOCS: 'https://docs.interchat.fun',
  SUPPORT_INVITE: 'https://discord.gg/8DhUA4HNpD',
  APP_DIRECTORY: 'https://discord.com/application-directory/769921109209907241',
  RULES_BANNER: 'https://i.imgur.com/MBG0Rks.png',
  EASTER_AVATAR: 'https://i.imgur.com/80nqtSg.png',
} as const;

export const channels = {
  devChat: '770488420521738250',
  networklogs: '1156144879869632553',
  modlogs: '1042265633896796231',
  reports: '1158773603551162398',
  goal: '906460473065615403',
  suggestions: '1021256657528954900',
  inviteLogs: '1246117516099457146',
} as const;

export const colors = {
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
} as const;
