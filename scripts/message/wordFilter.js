const { MessageEmbed, Message } = require('discord.js');
const emoji = require('../../emoji.json');
const { colors, getDb } = require('../../utils');
const Filter = require('bad-words'),
	filter = new Filter();

module.exports = {
	/**
	 * @param {Message} message
	 * @returns
	 */
	async execute(message) {
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

	async log(message) {
		const logChan = await message.client.channels.fetch('976099224611606588');
		const filterEmbed = new MessageEmbed()
			.setAuthor({ name: `${message.client.user.username} logs`, iconURL: message.client.user.avatarURL() })
			.setTitle('Bad Word Detected')
			.setColor(colors('chatbot'))
			.setDescription(`||${message.content}||\n\n**Author:** \`${message.author.tag}\` (${message.author.id})\n**Server:** ${message.guild.name} (${message.guild.id})`);
		await logChan.send({ embeds: [filterEmbed] });
	},
};