import {
  ActionRow,
  ButtonStyle,
  ChannelType,
  ComponentType,
  Message,
  MessageActionRowComponent,
  NewsChannel,
  Snowflake,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import { DeveloperIds, StaffIds, SupporterIds, URLs } from './Constants.js';
import Scheduler from '../structures/Scheduler.js';
import { randomBytes } from 'crypto';

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
  return Object.entries(reactions).sort((a, b) => b[1].length - a[1].length); // => [ [ '👎', ['10201930193'] ], [ '👍', ['10201930193'] ] ]
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

export function disableComponents(message: Message) {
  return message.components.flatMap((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => (component.disabled = true));
    return jsonRow;
  });
}

export async function getOrCreateWebhook(
  channel: NewsChannel | TextChannel | ThreadChannel,
  avatar = 'https://i.imgur.com/80nqtSg.png',
) {
  const channelOrParent =
    channel.type === ChannelType.GuildText || channel.type == ChannelType.GuildAnnouncement
      ? channel
      : channel.parent;

  const webhooks = await channelOrParent?.fetchWebhooks();
  const existingWebhook = webhooks?.find((w) => w.owner?.id === channel.client.user?.id);

  if (existingWebhook) {
    return existingWebhook;
  }

  return await channelOrParent?.createWebhook({
    name: 'InterChat Network',
    avatar,
  });
}

export function getCredits() {
  return [...DeveloperIds, ...StaffIds, ...SupporterIds];
}

export function checkIfStaff(userId: string, onlyCheckForDev = false) {
  const staffMembers = [...DeveloperIds, ...(onlyCheckForDev ? [] : StaffIds)];

  if (staffMembers.includes(userId)) return true;
  return false;
}

/**
 *
 * @param scheduler The scheduler to use
 * @param message The message on which to disable components
 * @param time The time in milliseconds after which to disable the components
 */
export function setComponentExpiry(
  scheduler: Scheduler,
  message: Message,
  time: number | Date,
): string {
  const timerId = randomBytes(8).toString('hex');
  scheduler.addTask(`disableComponents_${timerId}`, time, async () => {
    const updatedMsg = await message.fetch().catch(() => null);
    if (updatedMsg?.components.length === 0 || !updatedMsg?.editable) return;

    const disabled = disableAllComponents(message.components);
    await updatedMsg.edit({ components: disabled });
  });

  return timerId;
}

export function disableAllComponents(
  components: ActionRow<MessageActionRowComponent>[],
  disableLinks = false,
) {
  return components.map((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => {
      !disableLinks &&
      (component.type === ComponentType.Button &&
      component.style === ButtonStyle.Link)
        ? (component.disabled = false) // leave link buttons enabled
        : (component.disabled = true);
    });
    return jsonRow;
  });
}
