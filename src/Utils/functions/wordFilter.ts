import { EmbedBuilder, Client, Guild, User, TextChannel } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
import badwords from 'badwords-list';

const whiteListedWords = ['crap', 'hell', 'damn'];
const blacklistedWords = badwords.array.filter(word => whiteListedWords.includes(word) === false);

export = {
	/**
	 * Checks if a message contains any bad words.
	*/
	check(string?: string) {
		if (!string) throw new Error('No string provided.');
		for (const word of blacklistedWords) {
			if (string?.includes(word)) return true;
		}
		return false;
	},

	/**
	 * If the message contains bad words, it will be censored with asterisk(*).
	*/
	censor(message: string): string {
		// filter bad words from message
		// and replace it with *
		let filtered = message;
		blacklistedWords.forEach((word) => {
			filtered = filtered
				.replaceAll(new RegExp(`\\b${word}\\b`, 'g'), '\\*'.repeat(word.length));
		});
		// return the new filtered message
		return filtered;
	},

	/**
	 * Log the *uncensored* message to the logs channel.
	*/
	async log(client: Client, author: User, guild: Guild, messageContent: string) {
		const rawContent = messageContent;
		const logChan = await client.channels.fetch(constants.channel.chatbotlogs) as TextChannel;
		const logEmbed = new EmbedBuilder()
			.setAuthor({ name: `${client.user?.username} logs`, iconURL: client.user?.avatarURL()?.toString() })
			.setTitle('Bad Word Detected')
			.setColor(colors('chatbot'))
			.setDescription(`||${rawContent}||\n\n**Author:** \`${author.tag}\` (${author.id})\n**Server:** ${guild.name} (${guild.id})`);
		return await logChan?.send({ embeds: [logEmbed] });
	},
};