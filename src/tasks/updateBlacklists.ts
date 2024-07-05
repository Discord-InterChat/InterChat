import { ClusterManager } from 'discord-hybrid-sharding';
import { Client } from 'discord.js';

export default async (manager: ClusterManager) => {
  await manager.broadcastEval(
    async (_client) => {
      const client = _client as unknown as Client;
      const allUsers = await client.userManager.getAllBlacklists();

      // TODO: same for serverBlacklists
      allUsers?.forEach((user) => {
        user?.blacklistedFrom.forEach(async (bl) => {
          if (bl.expires && new Date(String(bl.expires)) <= new Date()) {
            if (client.user) {
              await client.userManager.logUnblacklist(bl.hubId, user.id, {
                mod: client.user,
                reason: 'Blacklist expired for user.',
              });
            }
            const upd = await client.userManager.removeBlacklist(bl.hubId, user.id);

            console.log(
              `Updated blacklist for user ${user.id}. Total users: ${allUsers?.length}. Updated: ${upd}`,
            );
          }
        });
      });
    },
    { shard: 0 },
  );
};
