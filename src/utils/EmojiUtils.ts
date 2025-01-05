import type { Client } from 'discord.js';
import emojis from './JSON/emojis.json' with { type: 'json' };

export type EmojiKeys = keyof typeof emojis;

export const getEmoji = (name: EmojiKeys, client: Client): string => {
  const emojiId = client.application?.emojis.cache.findKey((emoji) => emoji.name === name);
  if (!emojiId) return '';
  return `<:${name}:${emojiId}>`;
};
