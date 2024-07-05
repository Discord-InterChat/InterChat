import { Client } from 'discord.js';

/**
 * Checks if a user or server is blacklisted in a given hub.
 * @param hubId - The ID of the hub to check in.
 * @param guildId - The ID of the guild to check for blacklist.
 * @param userId - The ID of the user to check for blacklist.
 * @returns An object containing whether the user and/or server is blacklisted in the hub.
 */
export const checkBlacklists = async (
  client: Client,
  hubId: string,
  guildId: string,
  userId: string,
) => {
  const userBlacklisted = await client.userManager.fetchBlacklist(hubId, userId);
  const guildBlacklisted = await client.serverBlacklists.fetchBlacklist(hubId, guildId);

  if (userBlacklisted || guildBlacklisted) {
    return { userBlacklisted, serverBlacklisted: guildBlacklisted };
  }

  return { userBlacklisted: false, serverBlacklisted: false };
};
