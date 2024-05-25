import { REGEX } from './Constants.js';
/**
 * Checks if a string contains profanity or slurs.
 * @param string - The string to check.
 * @returns An object with two boolean properties: `profanity` and `slurs`.
 */
export const check = (string: string | undefined) => {
  if (!string) return { hasProfanity: false, hasSlurs: false };
  // NOTE: Since the regex is created using RegExp, the regex keeps internally the state of the search
  // and may give unexpected results if used multiple times. https://dev.to/dvddpl/why-is-my-regex-working-intermittently-4f4g
  const profanity = string.match(REGEX.PROFANITY);
  const slurs = string.match(REGEX.SLURS);

  return {
    hasProfanity: profanity ? profanity.length > 0 : false,
    hasSlurs: slurs ? slurs.length > 0 : false,
  };
};

/**
 * Replaces profanity and slurs in a string with a specified symbol.
 * @param string - The string to censor.
 * @param symbol - The symbol to replace the profanity and slurs with. Defaults to `\*`.
 * @returns The censored string.
 */
export const censor = (string: string, symbol = '\\*'): string => {
  const replaceFunc = (match: string) => symbol.repeat(match.length);
  return string.replace(REGEX.PROFANITY, replaceFunc).replace(REGEX.SLURS, replaceFunc);
};
