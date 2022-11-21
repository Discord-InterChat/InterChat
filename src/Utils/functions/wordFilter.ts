import { EmbedBuilder, Client, Guild, User, TextChannel } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
import { badwords } from '../JSON/badwords.json';

export = {
	/**
	 * Checks if a message contains any bad words.
	*/
	check(string: string | undefined) {
		if (!string) return false;
		return badwords.some(word => string.split(/\b/).some(w => w.toLowerCase() === word.toLowerCase()));
	},

	/**
	 * If the message contains bad words, it will be censored with asterisk(*).
	 *
	 * Code refrernced from [`@web-mech/badwords`](https://github.com/web-mech/badwords).
	*/
	censor(message: string): string {
		const splitRegex = /\b/;
		const specialChars = /[^a-zA-Z0-9|$|@]|\^/g;
		const matchWord = /\w/g;
		// filter bad words from message
		// and replace it with *
		return message.split(splitRegex).map(word => {
			return this.check(word) ? word.replace(specialChars, '').replace(matchWord, '\\*') : word;
		}).join(splitRegex.exec(message)?.at(0));
	},

	/**
	 * Log the *uncensored* message to the log channel.
	*/
	async log(client: Client, author: User, guild: Guild | null, rawContent: string) {
		const logChan = await client.channels.fetch(constants.channel.networklogs) as TextChannel;
		const logEmbed = new EmbedBuilder()
			.setAuthor({ name: `${client.user?.username} logs`, iconURL: client.user?.avatarURL()?.toString() })
			.setTitle('Bad Word Detected')
			.setColor(colors('invisible'))
			.setDescription(`||${rawContent}||\n\n**Author:** \`${author.tag}\` (${author.id})\n**Server:** ${guild?.name} (${guild?.id})`);
		return await logChan?.send({ embeds: [logEmbed] });
	},
};