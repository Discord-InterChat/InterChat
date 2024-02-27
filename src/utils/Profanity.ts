import { REGEX } from './Constants.js';

/**
 * Checks if a string contains profanity or slurs.
 * @param string - The string to check.
 * @returns An object with two boolean properties: `profanity` and `slurs`.
 */
export function check(string: string | undefined) {
  if (!string) return { profanity: false, slurs: false };

  return {
    profanity: REGEX.PROFANITY.test(string.toLowerCase()),
    slurs: REGEX.SLURS.test(string.toLowerCase()),
  };
}

/**
 * Replaces profanity and slurs in a string with a specified symbol.
 * @param string - The string to censor.
 * @param symbol - The symbol to replace the profanity and slurs with. Defaults to `\*`.
 * @returns The censored string.
 */
export function censor(string: string, symbol = '\\*'): string {
  const repeatSymbol = (match: string) => symbol.repeat(match.length);
  return string.replace(REGEX.PROFANITY, repeatSymbol).replace(REGEX.SLURS, repeatSymbol);
}
