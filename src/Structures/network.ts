import { connectedList, Prisma } from '@prisma/client';
import { Guild, GuildTextBasedChannel } from 'discord.js';
import { prisma } from '../Utils/db';
import { getDb } from '../Utils/functions/utils';

interface NetworkManagerOptions {
	serverId?: string;
	channelId?: string;
}

export class NetworkManager {
	protected db = getDb();

	constructor() {/**/}

	/** Returns found document from connectedList collection. */
	public async getServerData(filter: NetworkManagerOptions) {
		const foundServerData = await prisma.connectedList.findFirst({ where: filter });

		return foundServerData;
	}

	public async updateData(filter: NetworkManagerOptions, data: NetworkManagerOptions): Promise<connectedList>
	public async updateData(channelId: string, data: NetworkManagerOptions): Promise<connectedList>
	public async updateData(where: NetworkManagerOptions | string, data: NetworkManagerOptions) {
		if (typeof where === 'string') return await prisma.connectedList.update({ where: { channelId: where }, data });
		return await prisma.connectedList.updateMany({ where, data });
	}

	/**
	 * Insert a guild & channel into connectedList collection.
   	* Returns **null** if channel is already connected
	*/
	public async connect(guild: Guild | null, channel: GuildTextBasedChannel | undefined | null) {
		const channelExists = await prisma.connectedList.findFirst({
			where: {
				channelId: channel?.id,
			},
		});

		if (channelExists) return null;
		if (!guild || !channel) throw new Error('Invalid arguments provided.');

		return await prisma.connectedList.create({
			data: {
				channelId: channel?.id,
				serverId: guild?.id,
			},
		});
	}

	/** Delete a document using the `channelId` or `serverId` from the connectedList collection */
	public async disconnect(options: NetworkManagerOptions): Promise<Prisma.BatchPayload>;
	/**  Delete a document using the `serverId` from the connectedList collection */
	public async disconnect(serverId: string | null): Promise<Prisma.BatchPayload>;
	public async disconnect(options: NetworkManagerOptions | string | null): Promise<Prisma.BatchPayload> {
		if (typeof options === 'string') {
			return await prisma.connectedList.deleteMany({
				where: { serverId: options },
			});
		}

		return await prisma.connectedList.deleteMany({ where: options ?? undefined });
	}

	/** Returns a promise with the total number of connected servers.*/
	public async totalConnected() {
		return await prisma.connectedList.count();
	}
}
