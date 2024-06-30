import UserBlacklistManager from '../../managers/UserBlacklistManager.js';
import ServerBlacklisManager from '../../managers/ServerBlacklistManager.js';
import { blacklistedServers, userData } from '@prisma/client';

function isUserBlacklist(blacklist: blacklistedServers | userData): blacklist is userData {
  return 'userId' in blacklist;
}

export default async (blacklists: (blacklistedServers | userData)[]) => {
  if (blacklists.length === 0) return;

  const userBlacklists = new UserBlacklistManager();
  const serverBlacklists = new ServerBlacklisManager();

  for (const blacklist of blacklists) {
    const blacklistedFrom = isUserBlacklist(blacklist) ? blacklist.blacklistedFrom : blacklist.hubs;
    const manager = isUserBlacklist(blacklist) ? userBlacklists : serverBlacklists;
    const id = isUserBlacklist(blacklist) ? blacklist.userId : blacklist.serverId;

    for (const { hubId, expires } of blacklistedFrom) {
      if (expires && expires < new Date()) {
        await manager.removeBlacklist(hubId, id);
      }
      continue;
    }
  }
};
