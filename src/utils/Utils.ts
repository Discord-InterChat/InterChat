import { Snowflake } from 'discord.js';
import { URLs } from './Constants.js';

/** Convert milliseconds to a human readable time (eg: 1d 2h 3m 4s) */
export function msToReadable(milliseconds: number): string {
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

export function wait(ms: number): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sort the array based on the reaction counts */
export function sortReactions(reactions: { [key: string]: string[] }): [string, string[]][] {
  // before: { '👍': ['10201930193'], '👎': ['10201930193'] }
  return Object
    .entries(reactions)
    .sort((a, b) => b[1].length - a[1].length); // => [ [ '👎', ['10201930193'] ], [ '👍', ['10201930193'] ] ]
}

export async function hasVoted(userId: Snowflake): Promise<boolean> {
  if (!process.env.TOPGG_API_KEY) throw new TypeError('Missing TOPGG_API_KEY environment variable');

  const res = await (
    await fetch(`${URLs.TOPGG_API}/check?userId=${userId}`, {
      method: 'GET',
      headers: {
        Authorization: process.env.TOPGG_API_KEY,
      },
    })
  ).json();

  return !!res.voted;
}

export function yesOrNoEmoji(option: unknown, yesEmoji: string, noEmoji: string) {
  return option ? yesEmoji : noEmoji;
}