const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../utils');
const Filter = require('bad-words'), filter = new Filter();

module.exports = {
	/**
	 * If the message contains bad words, it will be censored with asterisk(*).
	 * @param {Message} message
	 * @returns
	 */
	censor(message) {
		try {
			// filter bad words from message
			// and replace it with  *
			const filtered = filter.clean(message.content).replaceAll('*', '\\*');

			// log the real message to logs channel
			module.exports.log(message);

			// return the new filtered message
			return filtered;

		}
		catch {/**/}
	},

	check(message) {
		/*
		 TODO
		 if leo profanity says its bad, return true
		 if bad-words says its bad, return true

		Example code:
		leo = (loop through all words in their library)
		if (filter.isProfane(message.content) || leo-profanity.includes(message.content)) return true;
		or something
		it might not work because leo-profanity needs u to loop through their entire library and check one by one
		*/
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