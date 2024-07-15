import { blacklistedServers, userData } from '@prisma/client';
import { ClusterManager } from 'discord-hybrid-sharding';
import { Client } from 'discord.js';

export default async (manager: ClusterManager) => {
  await manager.broadcastEval(
    async (_client) => {
      const client = _client as unknown as Client;
      const allUsers = await client.userManager.getAllBlacklists();
      const allServers = await client.serverBlacklists.getAllBlacklists();

      const checkAndUnblacklist = (entities: (userData | blacklistedServers)[] | null, type: 'user' | 'server') => {
        entities?.forEach((entity) => {
          entity?.blacklistedFrom.forEach(async (bl) => {
            if (bl.expires && new Date(String(bl.expires)) <= new Date()) {
              const blacklistManager = type === 'user' ? client.userManager : client.serverBlacklists;
              if (client.user) {
                await blacklistManager.logUnblacklist(bl.hubId, entity.id, {
                  mod: client.user,
                  reason: `Blacklist expired for ${type}.`,
                });
              }
              const upd = await blacklistManager.removeBlacklist(bl.hubId, entity.id);

              console.log(
                `Updated blacklist for entity ${entity.id}. Total entities: ${entities?.length}. Updated: ${upd}`,
              );
            }
          });
        });
      };

      checkAndUnblacklist(allServers, 'server');
      checkAndUnblacklist(allUsers, 'user');
    },
    { shard: 0 },
  );
};
