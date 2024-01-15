import { AuditLogEvent, ChannelType, Guild, TextChannel } from 'discord.js';

/**
 * Retrieves the first channel in a guild or the inviter of the bot.
 * @param guild The guild to retrieve the target for.
 * @returns The greeting target, which can be a TextChannel or a User.
 */
export default async function getWelcomeTargets(guild: Guild) {
  let guildOwner = null;

  if (guild.members.me?.permissions.has('ViewAuditLog', true)) {
    const auditLog = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
    guildOwner = auditLog.entries.first()?.executor;
  }

  const guildChannel = guild.channels.cache
    .filter(
      (c) => c.type === ChannelType.GuildText && c.permissionsFor(guild.id)?.has('SendMessages'),
    )
    .first() as TextChannel | undefined;

  return { guildOwner, guildChannel };
}
