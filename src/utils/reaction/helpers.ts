import BlacklistManager from '#main/managers/BlacklistManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { isBlacklisted } from '#main/utils/moderation/blacklistUtils.js';

/**
 * Checks if a user or server is blacklisted in a given hub.
 * @param hubId - The ID of the hub to check in.
 * @param guildId - The ID of the guild to check for blacklist.
 * @param userId - The ID of the user to check for blacklist.
 * @returns An object containing whether the user and/or server is blacklisted in the hub.
 */
export const checkBlacklists = async (
  hubId: string,
  guildId: string | null,
  userId: string | null,
) => {
  const userBlacklistManager = userId
    ? new BlacklistManager(new UserInfractionManager(userId))
    : undefined;
  const guildBlacklistManager = guildId
    ? new BlacklistManager(new ServerInfractionManager(guildId))
    : undefined;

  const userBlacklist = await userBlacklistManager?.fetchBlacklist(hubId);
  const serverBlacklist = await guildBlacklistManager?.fetchBlacklist(hubId);

  return {
    userBlacklisted: isBlacklisted(userBlacklist ?? null),
    serverBlacklisted: isBlacklisted(serverBlacklist ?? null),
  };
};
