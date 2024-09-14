import { Channel, GuildTextBasedChannel } from 'discord.js';

export const isGuildTextBasedChannel = (
  channel: Channel | null | undefined,
): channel is GuildTextBasedChannel => Boolean(channel?.isTextBased() && !channel.isDMBased());
