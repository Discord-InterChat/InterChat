import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { colors, constants } from '../Utils/functions/utils';
import logger from '../Utils/logger';

interface ErrorLogData {
	level: 'INFO' | 'ERROR' | 'WARN';
	message: string;
	stack?: string;
	timestamp: string;
	[key: string]: unknown;
}

export async function handleErrors(client: Client) {
	process.on('uncaughtException', (err) => logger.error('[Anti-Crash - Exception]:', err));
	process.on('unhandledRejection', (err) => logger.error('[Anti Crash - Rejection]:', err));
	logger.on('data', (data: ErrorLogData) => {
		if (data.level === 'ERROR' && client.isReady()) sendErrorToChannel(client, data.message, data.stack);
	});
}

/** Only use this when you are not using the logger. As the logger will automatically send the error to the channel. */
export async function sendErrorToChannel(client: Client, embedTitle: string, ErrorStack: unknown, channel?: TextChannel | null) {
	const errorChannel = await client.channels.fetch(constants.channel.errorlogs);
	const errorEmbed = new EmbedBuilder()
		.setAuthor({ name: 'ChatBot Error Logs', iconURL: client.user?.avatarURL() || undefined })
		.setTitle(embedTitle)
		.setDescription('```js\n' + ErrorStack + '```')
		.setColor(colors('invisible'))
		.setTimestamp();


	return channel ? channel.send({ embeds: [errorEmbed] }) : errorChannel?.isTextBased() ? errorChannel?.send({ embeds: [errorEmbed] }) : undefined;
}