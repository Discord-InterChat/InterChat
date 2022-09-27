import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { colors } from '../Utils/functions/utils';
import logger from '../Utils/logger';

export async function handlErrors(client: Client) {
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
	const errorChannel = await client.channels.fetch('1024313459187404830'); // FIXME: Change channelId in constants
	const errorEmbed = new EmbedBuilder()
		.setAuthor({ name: 'ChatBot Error Reports', iconURL: client.user?.avatarURL() || undefined })
		.setTitle(embedTitle)
		.setDescription('```js\n' + ErrorStack + '```')
		.setColor(colors('invisible'))
		.setTimestamp();


	return channel ? channel.send({ embeds: [errorEmbed] }) : errorChannel?.isTextBased() ? errorChannel?.send({ embeds: [errorEmbed] }) : undefined;
}