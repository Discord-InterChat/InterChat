import type { APIChannel, Channel, GuildTextBasedChannel } from 'discord.js';

export const isGuildTextBasedChannel = (
  channel: Channel | APIChannel | null | undefined,
): channel is GuildTextBasedChannel =>
  Boolean(channel && 'isTextBased' in channel && channel.isTextBased() && !channel.isDMBased());
