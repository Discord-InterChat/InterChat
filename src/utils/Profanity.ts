// import { EmbedBuilder, User, TextChannel } from 'discord';
// import { constants, getGuildName, getHubName } from './utils';
import { createRequire } from 'node:module';
import badwordsType from './JSON/profanity.json';

// create a require a ESM doesn't support importing JSON
const require = createRequire(import.meta.url);
const badwords = require('./JSON/profanity.json') as typeof badwordsType;

/**
 * Checks if a message contains any bad words.
 */
export function check(string: string | undefined) {
  if (!string) return { profanity: false, slurs: false };
  const profanity = badwords.profanity.some((word) =>
    string.split(/\b/).some((w) => w.toLowerCase() === word.toLowerCase()),
  );
  const slurs = badwords.slurs.some((word) =>
    string.split(/\b/).some((w) => w.toLowerCase() === word.toLowerCase()),
  );

  return { profanity, slurs };
}

/**
 * If the message contains bad words, it will be censored with asterisk(*).
 *
 * Code referenced from [`@web-mech/badwords`](https://github.com/web-mech/badwords).
 */
export function censor(message: string): string {
  const splitRegex = /\b/;
  const specialChars = /[^a-zA-Z0-9|$|@]|\^/g;
  const matchWord = /\w/g;
  // filter bad words from message
  // and replace it with *
  return message
    .split(splitRegex)
    .map((word) => {
      const { profanity, slurs } = check(word);
      return profanity || slurs ? word.replace(specialChars, '').replace(matchWord, '\\*') : word;
    })
    .join(splitRegex.exec(message)?.at(0));
}
