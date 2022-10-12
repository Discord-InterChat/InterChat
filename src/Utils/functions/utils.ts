import logger from '../logger';
import discord, { Guild, GuildTextBasedChannel } from 'discord.js';
import { MongoClient, Db, AnyError, DeleteResult } from 'mongodb';
import { Api } from '@top-gg/sdk';
import util from 'util';
import 'dotenv/config';
import { connectedListDocument } from '../typings/types';

const topgg = new Api(process.env.TOPGG as string);
const uri = process.env.MONGODB_URI as string;
let _db: Db | undefined;


String.prototype.toTitleCase = function() {
	let upper = true;
	let newStr = '';
	for (let i = 0, l = this.length; i < l; i++) {
		if (this[i] == ' ') {
			upper = true;
			newStr += this[i];
			continue;
		}
		newStr += upper ? this[i].toUpperCase() : this[i].toLowerCase();
		upper = false;
	}
	return String(newStr);
};

discord.Client.prototype.sendInNetwork = async function(message: string) {
	const database = _db;
	const connectedList = database?.collection('connectedList');
	const channels = await connectedList?.find().toArray();

	channels?.forEach((channelEntry) => {
		this.channels.fetch(channelEntry.channelId)
			.then(async (channel) => {
				if (!channel?.isTextBased()) {
					logger.error(`Channel ${channel?.id} is not text based!`);
					return;
				}
				await channel.send(message);
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
	for (const channel of channels) {
		if (channel[1]?.type == discord.ChannelType.GuildText) {
			if (channel[1].permissionsFor(guild.members.me as discord.GuildMember)?.has('SendMessages')) {
				try {
					await channel[1].send(message);
					break;
				}
				catch (err) {
					logger.error(err);
				}
			}
		}
	}
}

export async function getCredits() {
	let creditArray: string[] = [];

	creditArray = creditArray.concat(
		constants.developers,
		constants.staff,
	);

	return creditArray;
}

export function connect(callback: (err: AnyError | null, state: boolean) => unknown) {
	MongoClient.connect(uri)
		.then((client) => {
			_db = client.db('Discord-ChatBot');
			callback(null, true);
		})
		.catch((err) => {return callback(err, false);});
}
/**
* Returns the database
*/
export function getDb(): Db | undefined {
	return _db;
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

export async function clean(client: discord.Client, text: string) {
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
	const database = _db;

	if (!database) throw new Error('Database not connected');

	const connectedList = database.collection('connectedList');
	const channels = await connectedList.find().toArray();

	const unknownChannels = [];
	for (let i = 0; i < channels?.length; i++) {
		const element = channels[i];
		try {
			await client.channels.fetch(element.channelId);
		}
		catch (err: any) {
			if (err.message === 'Unknown Channel') {
				unknownChannels.push(element.channelId);
				continue;
			}
		}
	}

	if (unknownChannels.length > 0) {
		const deletedChannels = await connectedList.deleteMany({ channelId: { $in: unknownChannels } });
		logger.info(`Deleted ${deletedChannels.deletedCount} channels from the connectedList database.`);
		return;
	}
}

export const constants = {
	topgg,

	client: {
		stable: {
			id: '769921109209907241',
		},
		beta: {
			id: '798748015435055134',
		},
	},

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
		bugreports: '1006494592524369951',
		chatbotlogs: '1002864642101624832',
		errorlogs: '976099224611606588',
		modlogs: '1000730718474875020',
		reports: '821610981155012628',
		goal: '906460473065615403',
		suggestions: '1021256657528954900',
		reviews: '1002874342343970946',
	},
};

interface NetworkManagerOptions {
	serverId?: string | null;
	channelId?: string | null;
}

export class NetworkManager {

	protected db = getDb();
	public connectedList = this.db?.collection('connectedList');

	constructor() {/**/}

	public async getServerData(filter: NetworkManagerOptions) {
		const foundServerData = await this.connectedList?.findOne(filter);
		return foundServerData;
	}

	/**
	 * Returns true if the server/channel is connected.
	 */
	public async connected(options: NetworkManagerOptions) {
		const InDb = await this.connectedList?.findOne(options) as connectedListDocument | undefined | null;
		return InDb;
	}

	/**
	 * Connect a channel to the network.
	 *
	 * Returns **null** if channel is already connected
	 *
	 * **This only inserts the server into the connectedList collection.**
	 */
	public async connect(guild: Guild | null, channel: GuildTextBasedChannel | undefined | null) {
		const channelExists = await this.connectedList?.findOne({ channelId: channel?.id });

		if (channelExists) return null;
		if (!guild || !channel) throw new Error('Invalid arguments  provided.');

		return await this.connectedList?.insertOne({
			channelId: channel?.id,
			channelName: channel?.name,
			serverId: guild?.id,
			serverName: guild?.name,
		});
	}


	/** Delete a document using the `channelId` or `serverId` from the connectedList collection */
	public async disconnect(options: NetworkManagerOptions): Promise<DeleteResult | undefined>
	/**  Delete a document using the `serverId` from the connectedList collection*/
	async disconnect(serverId: string | null): Promise<DeleteResult | undefined>
	async disconnect(options: NetworkManagerOptions | string | null): Promise<DeleteResult | undefined> {
		if (typeof options === 'string') {
			return await this.connectedList?.deleteOne({ serverId: options });
		}
		else if (options?.channelId) {return await this.connectedList?.deleteOne({ channelId: options.channelId });}
		else {return await this.connectedList?.deleteOne({ serverId: options?.serverId });}
	}

	/** Returns a promise with the total number of connected servers.*/
	public async totalConnected() {
		return await this.connectedList?.countDocuments();
	}
}

export default { colors, choice, sendInFirst, getCredits, connect, getDb, toHuman, checkIfStaff, clean, deleteChannels, constants, NetworkManager };