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
			module.exports.log(message);

			// return the new filtered message
			return filtered;

		}
		catch {/**/}
	},

	async log(message) {
		const logChan = await message.client.channels.fetch('976099224611606588');
		const filterEmbed = new EmbedBuilder()
			.setAuthor({ name: `${message.client.user.username} logs`, iconURL: message.client.user.avatarURL() })
			.setTitle('Bad Word Detected')
			.setColor(colors('chatbot'))
			.setDescription(`||${message.content}||\n\n**Author:** \`${message.author.tag}\` (${message.author.id})\n**Server:** ${message.guild.name} (${message.guild.id})`);
		await logChan.send({ embeds: [filterEmbed] });
	},
};