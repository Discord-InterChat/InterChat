import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { colors, constants } from '../Utils/functions/utils';
import logger from '../Utils/logger';

export async function handleErrors(client: Client) {
	process.on('uncaughtException', async (err) => {
		if (client.isReady()) sendErrorToChannel(client, 'An Error Occured!', err.stack);
		logger.error('[Anti-Crash - Exception]:', err);
	});
	process.on('unhandledRejection', async (err) => {
		if (client.isReady()) sendErrorToChannel(client, 'A Request Got Rejected!', err);
		logger.error('[Anti Crash - Rejection]:', err);
	});
}

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