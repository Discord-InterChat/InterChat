/*
 * Copyright (C) 2025 InterChat
 *
 * InterChat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * InterChat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with InterChat.  If not, see <https://www.gnu.org/licenses/>.
 */

import Constants from '#utils/Constants.js';

/**
 * Checks if a string contains profanity or slurs.
 * @param string - The string to check.
 * @returns An object with two boolean properties: `profanity` and `slurs`.
 */
export const check = (string: string | undefined) => {
  if (!string) return { hasProfanity: false, hasSlurs: false };
  // NOTE: Since the regex is created using RegExp, the regex keeps internally the state of the search
  // and may give unexpected results if used multiple times. https://dev.to/dvddpl/why-is-my-regex-working-intermittently-4f4g
  const profanity = string.match(Constants.Regex.Profanity);
  const slurs = string.match(Constants.Regex.Slurs);

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
  return string
    .replace(Constants.Regex.Profanity, replaceFunc)
    .replace(Constants.Regex.Slurs, replaceFunc);
};
