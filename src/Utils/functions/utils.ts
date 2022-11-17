import logger from '../logger';
import discord from 'discord.js';
import util from 'util';
import { Api } from '@top-gg/sdk';
import 'dotenv/config';
import { prisma } from '../db';
import { Prisma, PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import _ from 'lodash/string';

const topgg = new Api(process.env.TOPGG as string);

export function toTitleCase(txt: string) {
	return _.startCase(_.toLower(txt));
}

export function getGuildName(client: discord.Client, gid: string | null) {
	if (!gid) return '';
	return client.guilds.cache.get(gid)?.name;
}

discord.Client.prototype.sendInNetwork = async function(message: string | discord.MessageCreateOptions) {
	const channels = await prisma.connectedList.findMany();

	channels?.forEach(async (channelEntry) => {
		const channel = await this.channels.fetch(channelEntry.channelId);
		if (!channel?.isTextBased()) {
			logger.error(`Channel ${channel?.id} is not text based!`);
			return;
		}
		await channel.send(message).catch((err) => {
			if (!err.message.includes('Missing Access') || !err.message.includes('Missing Permissions')) return;
			logger.error(err);
		});
	});
};

/**
* Random color generator for embeds
*/
export function colors(type: 'random' | 'chatbot' | 'invisible' = 'random') {
	const colorType = {
		random: [
			'Default',
			'White',
			'Aqua',
			'Green',
			'Blue',
			'Yellow',
			'Purple',
			'LuminousVividPink',
			'Fuchsia',
			'Gold',
			'Orange',
			'Red',
			'Grey',
			'DarkNavy',
			'DarkAqua',
			'DarkGreen',
			'DarkBlue',
			'DarkPurple',
			'DarkVividPink',
			'DarkGold',
			'DarkOrange',
			'DarkRed',
			'DarkGrey',
			'DarkerGrey',
			'LightGrey',
			'DarkNavy',
			'Blurple',
			'Greyple',
			'DarkButNotBlack',
			'NotQuiteBlack',
			'Random',
		] as discord.ColorResolvable[],
		chatbot: '#5CB5F9' as discord.HexColorString,
		invisible: '#2F3136' as discord.HexColorString,
	};

	// return the color type or a random color from the list
	return type === 'chatbot' ? colorType.chatbot : type === 'invisible' ? colorType.invisible :
		choice(colorType.random);
}
/**
* Returns random color (resolved) from choice of Discord.JS default color string
*/
export function choice(arr: discord.ColorResolvable[]) {
	return discord.resolveColor(arr[Math.floor(Math.random() * arr.length)]);
}

/**
* Send a message to a guild
*/
export async function sendInFirst(guild: discord.Guild, message: string | discord.MessagePayload | discord.BaseMessageOptions) {
	const channels = await guild.channels.fetch();

	const channel = channels
		.filter((chn) => chn?.isTextBased() && chn.permissionsFor(guild.members.me as discord.GuildMember).has('SendMessages'))
		.first();

	if (channel?.isTextBased()) channel.send(message).catch((e) => e.message.includes('Missing Access') || e.message.includes('Missing Permissions') ? null : logger.error(e));
	else logger.error(`Channel ${channel?.id} is not text based!`);
}

export async function getCredits() {
	let creditArray: string[] = [];

	creditArray = creditArray.concat(
		constants.developers,
		constants.staff,
	);

	return creditArray;
}

/**
* Returns the database
*/
export function getDb(): PrismaClient {
	return prisma;
}

/**
* Convert milliseconds to a human readable time (eg: 1d 2h 3m 4s)
*/
export function toHuman(milliseconds: number): string {
	let totalSeconds = milliseconds / 1000;
	const days = Math.floor(totalSeconds / 86400);
	totalSeconds %= 86400;
	const hours = Math.floor(totalSeconds / 3600);
	totalSeconds %= 3600;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	let readable;

	if (days == 0 && hours == 0 && minutes == 0) readable = `${seconds} seconds`;
	else if (days == 0 && hours == 0) readable = `${minutes}m ${seconds}s`;
	else if (days == 0) readable = `${hours}h, ${minutes}m ${seconds}s`;
	else readable = `${days}d ${hours}h, ${minutes}m ${seconds}s`;

	return readable;
}

/**
 * Checks if a user is a ChatBot Staff or Developer
 * @param client Discord.JS client
 * @param user The user to check
 * @param onlyDeveloper Check if the user is a developer
 */
export async function checkIfStaff(client: discord.Client, user: discord.GuildMember | discord.User, onlyDeveloper = false) {
	try {
		const staffRole = '800698916995203104';
		const developerRole = '770256273488347176';

		const allowedRoles = [staffRole, developerRole];

		const guild = await client.guilds.fetch('770256165300338709');
		const member = await guild.members.fetch(user);
		const roles = member.roles.cache;

		const isStaff = roles?.hasAny(...allowedRoles);
		const isDev = roles?.has(developerRole);

		if (onlyDeveloper && isDev) return true;
		else if (isStaff) return true;
		return false;
	}
	catch {
		return false;
	}
}

// eslint-disable-next-line
export async function clean(client: discord.Client, text: any) {
	// If our input is a promise, await it before continuing
	if (text && text.constructor.name == 'Promise') text = await text;

	// If the response isn't a string, `util.inspect()`
	// is used to 'stringify' the code in a safe way that
	// won't error out on objects with circular references
	// (like Collections, for example)
	if (typeof text !== 'string') text = util.inspect(text, { depth: 1 });

	// Replace symbols with character code alternatives
	text = text
		.replace(/`/g, '`' + String.fromCharCode(8203))
		.replace(/@/g, '@' + String.fromCharCode(8203));

	const redact = '\u001B[38;5;31m[REDACTED]\u001B[0m';
	const mongoRegex = /mongodb\+srv:\/\/.*|mongodb:\/\/.*/g;

	text = text.replaceAll(client.token as string, redact);
	text = text.replaceAll(process.env.TOPGG as string, redact);
	text = text.replace(mongoRegex, redact);
	// Send off the cleaned up result
	return text;
}

/**
* Delete channels from databse that chatbot doesn't have access to.
*/
export async function deleteChannels(client: discord.Client) {
	const channels = await prisma.connectedList.findMany();

	const unknownChannels = [];
	for (let i = 0; i < channels?.length; i++) {
		const element = channels[i];
		try {
			await client.channels.fetch(element.channelId);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		catch (err: any) {
			if (err.message === 'Unknown Channel') {
				unknownChannels.push(element.channelId);
				continue;
			}
		}
	}

	if (unknownChannels.length > 0) {
		const deletedChannels = await prisma.connectedList.deleteMany({
			where: {
				channelId: {
					in: unknownChannels,
				},
			},
		});
		logger.info(`Deleted ${deletedChannels.count} channels from the connectedList database.`);
		return;
	}
}

export const constants = {
	topgg,

	developers: [
		'736482645931720765',
		'828492978716409856',
		'748190663597883392',
		'701727675311587358',
		'827745783964499978',
	],
	staff: ['442653948630007808', '336159680244219905'],

	mainGuilds: {
		cbhq: '770256165300338709',
		cbTest: '969920027421732874',
		botTest: '818348790435020810',
	},

	channel: {
		bugs: '1035135196053393418',
		chatbotlogs: '1002864642101624832',
		errorlogs: '1024313459187404830',
		modlogs: '1000730718474875020',
		reports: '821610981155012628',
		goal: '906460473065615403',
		suggestions: '1021256657528954900',
		reviews: '1002874342343970946',
	},
};

interface NetworkManagerOptions {
	serverId?: string | undefined;
	channelId?: string | undefined;
}

export class NetworkManager {

	protected db = getDb();

	constructor() {/**/ }

	public async getServerData(filter: NetworkManagerOptions) {
		const foundServerData = await prisma.connectedList.findFirst({ where: filter });

		return foundServerData;
	}

	/**
	 * Returns found document if the server/channel is connected.
	 */

	// duplicate work as above
	/*	public async connected(options: NetworkManagerOptions) {
		const InDb = await prisma.connectedList.findFirst({
			where: {
				serverId: options.
			}
		});
		return InDb;
	}*/

	/**
	 * Connect a channel to the network.
	 *
	 * Returns **null** if channel is already connected
	 *
	 * **This only inserts the server into the connectedList collection.**
	 */
	public async connect(guild: discord.Guild | null, channel: discord.GuildTextBasedChannel | undefined | null) {
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
	public async disconnect(options: NetworkManagerOptions): Promise<Prisma.BatchPayload>
	/**  Delete a document using the `serverId` from the connectedList collection*/
	async disconnect(serverId: string | null): Promise<Prisma.BatchPayload>
	async disconnect(options: NetworkManagerOptions | string | null): Promise<Prisma.BatchPayload> {
		if (typeof options === 'string') {
			return await prisma.connectedList.deleteMany({
				where: {
					serverId: options,
				},
			});
		}

		return await prisma.connectedList.deleteMany({ where: options ?? undefined });
	}

	/** Returns a promise with the total number of connected servers.*/
	public async totalConnected() {
		return await prisma.connectedList.count();
	}
}
