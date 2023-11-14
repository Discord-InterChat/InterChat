import { REGEX } from './Constants.js';

/**
 * Checks if a string contains profanity or slurs.
 * @param string - The string to check.
 * @returns An object with two boolean properties: `profanity` and `slurs`.
 */
export function check(string: string | undefined) {
  if (!string) return { profanity: false, slurs: false };

  return {
    profanity: REGEX.PROFANITY.test(string),
    slurs: REGEX.SLURS.test(string),
  };
}

/**
 * Censors profanity and slurs from a given message by replacing them with asterisks(*).
 *
 * Code referenced from [`@web-mech/badwords`](https://github.com/web-mech/badwords).
 * @param message - The message to be censored.
 * @returns The censored message.
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
