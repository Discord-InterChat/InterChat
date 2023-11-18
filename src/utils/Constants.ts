import { stripIndents } from 'common-tags';
import { Colors, EmbedBuilder, HexColorString } from 'discord.js';
import { normal, badge, mascot } from './JSON/emojis.json';
import { createRequire } from 'module';
import 'dotenv/config';
import badwordsType from './JSON/profanity.json';

const require = createRequire(import.meta.url);

// create a require a ESM doesn't support importing JSON
const emotes = require('./JSON/emojis.json');
const badwords = require('./JSON/profanity.json') as typeof badwordsType;

export const isDevBuild = process.env.NODE_ENV === 'development';

export const CLIENT_ID = isDevBuild ? '798748015435055134' : '769921109209907241';
export const SUPPORT_SERVER_ID = '770256165300338709';

export const emojis: typeof normal = emotes.normal;
export const mascotEmojis: typeof mascot = emotes.mascot;
export const badgeEmojis: typeof badge = emotes.badge;

// Regexp
export const REGEX = {
  IMAGE_URL:
    /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.gif|\.png)/,
  /** no animated images */
  STATIC_IMAGE_URL:
    /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.png)/,
  /** ignores giphy and tenor */
  LINKS: /https?:\/\/(?!tenor\.com|giphy\.com)\S+/g,
  /** matches imgur urls */
  IMGUR_LINKS:
    /(?:https?:\/\/)?(?:www\.)?imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)(?:\.[a-zA-Z]+)?/i,
  /** matches profanity words */
  PROFANITY: new RegExp(`\\b(${badwords.profanity.join('|')})\\b`, 'ig'),
  /** matches slurs */
  SLURS: new RegExp(`\\b(${badwords.slurs.join('|')})\\b`, 'ig'),
};

export const StaffIds = ['597265261665714186', '442653948630007808', '689082827979227160'];
export const DeveloperIds = ['828492978716409856', '701727675311587358', '456961943505338369'];
export const SupporterIds = ['880978672037802014'];

export const LINKS = {
  TOPGG_API: 'https://top.gg/api/bots/769921109209907241',
  VOTE: 'https://top.gg/bot/769921109209907241/vote',
  DOCS: 'https://discord-interchat.github.io/docs',
  SUPPORT_INVITE: 'https://discord.gg/6bhXQynAPs',
  APP_DIRECTORY: 'https://discord.com/application-directory/769921109209907241',
} as const;

export const channels = {
  bugs: '1035135196053393418',
  networklogs: '1156144879869632553',
  modlogs: '1042265633896796231',
  reports: '1158773603551162398',
  goal: '906460473065615403',
  suggestions: '1021256657528954900',
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
  interchatBlue: '#5CB5F9' as HexColorString,
  invisible: '#2F3136' as HexColorString,
  christmas: ['#00B32C', '#D6001C', '#FFFFFF'] as HexColorString[],
} as const;

export const rulesEmbed = new EmbedBuilder()
  .setColor(colors.interchatBlue)
  .setImage('https://i.imgur.com/MBG0Rks.png').setDescription(stripIndents`
  ### 📜 InterChat Network Rules

  1. **Use Common Sense:** Be considerate of others and their views. No slurs, extreme derogatory language or any actions that can disrupt the chat's comfort.
  2. **No Spamming or Flooding:** Avoid repeated, nonsensical, or overly lengthy messages.
  3. **Keep Private Matters Private:** Avoid sharing personal information across the network.
  4. **No Harassment:** Trolling, insults, or harassment of any kind are not tolerated.
  5. **No NSFW/NSFL Content:** Posting explicit NSFW/NSFL content will result in immediate blacklist.
  6. **Respect Sensitive Topics:** Do not trivialize self-harm, suicide, violence, or other offensive topics.
  7. **Report Concerns:**  If you observe a violation of these rules, report it to the appropriate hub moderator or InterChat staff for further action.

  Any questions? Join our [support server](${LINKS.SUPPORT_INVITE}).
`);
