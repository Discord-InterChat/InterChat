import { blacklistedServers, userData } from '@prisma/client';
import BlacklistManager from '../../managers/BlacklistManager.js';
import Scheduler from '../../services/SchedulerService.js';

export default async (blacklists: (blacklistedServers | userData)[], scheduler: Scheduler) => {
	if (blacklists.length === 0) return;

	const blacklistManager = new BlacklistManager(scheduler);
	for (const blacklist of blacklists) {
		const blacklistedFrom = 'hubs' in blacklist ? blacklist.hubs : blacklist.blacklistedFrom;
		for (const { hubId, expires } of blacklistedFrom) {
			if (!expires) continue;

			if (expires < new Date()) {
				if ('serverId' in blacklist) {
					blacklistManager.removeBlacklist('server', hubId, blacklist.serverId);
				}
				else {
					await blacklistManager.removeBlacklist('user', hubId, blacklist.userId);
				}
				continue;
			}

			blacklistManager.scheduleRemoval(
				'serverId' in blacklist ? 'server' : 'user',
				'serverId' in blacklist ? blacklist.serverId : blacklist.userId,
				hubId,
				expires,
			);
		}
	}
};
