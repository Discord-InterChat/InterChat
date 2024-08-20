import db from '#main/utils/Db.js';
import { blacklistedServers, hubBlacklist, userData } from '@prisma/client';
import { ClusterManager } from 'discord-hybrid-sharding';
import { Client } from 'discord.js';

type OmittedBlacklistedFrom = Omit<hubBlacklist, 'expires'> & {
  expires: string | null;
};

type StringifiedUserData = Omit<userData, 'lastVoted' | 'blacklistedFrom'> & {
  lastVoted: string | null;
  blacklistedFrom: OmittedBlacklistedFrom[];
};

type StringifiedServerData = Omit<blacklistedServers, 'blacklistedFrom'> & {
  blacklistedFrom: OmittedBlacklistedFrom[];
};

export default async (manager: ClusterManager) => {
  const query = {
    where: { blacklistedFrom: { some: { expires: { not: null, lte: new Date() } } } },
  };

  const allUsers = await db.userData.findMany(query);
  const allServers = await db.blacklistedServers.findMany(query);

  await manager.broadcastEval(
    (_client, { userBls, serverBls }) => {
      const client = _client as unknown as Client;

      const checkAndUnblacklist = (
        entities: (StringifiedUserData | StringifiedServerData)[] | null,
        type: 'user' | 'server',
      ) => {
        entities?.forEach((entity) => {
          entity?.blacklistedFrom.forEach(async (bl) => {
            const blacklistManager = type === 'user' ? client.userManager : client.serverBlacklists;
            if (client.user) {
              await blacklistManager.logUnblacklist(bl.hubId, entity.id, {
                mod: client.user,
                reason: `Blacklist expired for ${type}.`,
              });
            }
            const upd = await blacklistManager.removeBlacklist(bl.hubId, entity.id);

            // Logger cant be used inside eval
            // eslint-disable-next-line no-console
            console.log(
              `Updated blacklist for entity ${entity.id}. Total entities: ${entities?.length}. Updated: `,
              upd,
            );
          });
        });
      };

      checkAndUnblacklist(serverBls, 'server');
      checkAndUnblacklist(userBls, 'user');
    },
    { shard: 0, context: { userBls: allUsers, serverBls: allServers } },
  );
};
