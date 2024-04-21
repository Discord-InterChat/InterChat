import { REGEX, profanity, slurs } from './Constants.js';

/**
 * Checks if a string contains profanity or slurs.
 * @param string - The string to check.
 * @returns An object with two boolean properties: `profanity` and `slurs`.
 */
export function check(string: string | undefined) {
  if (!string) return { profanity: false, slurs: false };

  return {
    profanity: profanity.some((word) =>
      string.split(/\b/).some((w) => w.toLowerCase() === word.toLowerCase()),
    ),
    slurs: slurs.some((word) =>
      string.split(/\b/).some((w) => w.toLowerCase() === word.toLowerCase()),
    ),
  };
}

/**
 * Replaces profanity and slurs in a string with a specified symbol.
 * @param string - The string to censor.
 * @param symbol - The symbol to replace the profanity and slurs with. Defaults to `\*`.
 * @returns The censored string.
 */
export function censor(string: string, symbol = '\\*'): string {
  return string
    .split(REGEX.SPLIT_WORDS)
    .map((word) => {
      const { profanity, slurs } = check(word);
      return profanity ?? slurs
        ? word.replace(REGEX.SPECIAL_CHARACTERS, '').replace(REGEX.MATCH_WORD, symbol)
        : word;
    })
    .join(string.match(REGEX.SPLIT_WORDS)?.at(0));
}
