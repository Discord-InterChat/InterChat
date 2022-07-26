const { EmbedBuilder, Message } = require('discord.js');
const { colors } = require('../../utils');
const Filter = require('bad-words'), prof_filter = new Filter();
const leo_filter = require('leo-profanity');

module.exports = {

	check(message) {
		if (prof_filter.isProfane(message.content || message)) return true;
		leo_filter.list().forEach(word => {
			if (message.content.includes(word) || message.content.includes(word)) return true;
		});

		return false;
	},

	/**
	 * If the message contains bad words, it will be censored with asterisk(*).
	 * @param {Message} message
	 * @returns {string} filtered message
	 */
	censor(message) {
		try {
			// filter bad words from message
			// and replace it with  *
			const filtered = prof_filter.clean(message.content).replaceAll('*', '\\*');

			// log the real message to logs channel
			module.exports.log(message, '1000730718474875020');

			// return the new filtered message
			return filtered;

		}
		catch {/**/}
	},
	/**
	 * Logs the *uncensored* message to a channel.
	 * @param {Message} message Message that needs to be logged
	 * @param {string} channelId The channel id of the logs channel
	 */
	async log(message, channelId) {
		const rawContent = message.content;
		const logChan = await message.client.channels.fetch(channelId);
		const filterEmbed = new EmbedBuilder()
			.setAuthor({ name: `${message.client.user.username} logs`, iconURL: message.client.user.avatarURL() })
			.setTitle('Bad Word Detected')
			.setColor(colors('chatbot'))
			.setDescription(`||${rawContent}||\n\n**Author:** \`${message.author.tag}\` (${message.author.id})\n**Server:** ${message.guild.name} (${message.guild.id})`);
		await logChan.send({ embeds: [filterEmbed] });
	},
};