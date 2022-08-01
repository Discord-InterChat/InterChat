const { EmbedBuilder, Message } = require('discord.js');
const { colors } = require('../../utils/functions/utils');
const discordIds = require('../../utils/discordIds.json');
const BadWordsFilter = require('bad-words'),
	badWordsFilter = new BadWordsFilter();


module.exports = {
	/**
	 * If the message contains bad words, it will be censored with asterisk(*).
	 * @param {Message} message
	 * @returns {string} filtered message
	 */
	checkAndCensor(message) {
		if (!message) throw new Error('Message parameter is required');

		if (badWordsFilter.isProfane(message.content)) {

			try {
				// filter bad words from message
				// and replace it with *
				const filtered = badWordsFilter.clean(message.content).replaceAll('*', '\\*');

				// log the real message to logs channel
				module.exports.log(message.content, discordIds.channel.chatbotlogs); // REVIEW: Import the channel id from config file

				// return the new filtered message
				return filtered;

			}
			catch {/**/}
		}

		else {
			return message.content;
		}
	},
	/**
	 * Logs the *uncensored* message to a channel.
	 * @param {Message} message Message that needs to be logged
	 * @param {string} channelId The channel id of the logs channel
	 */
	async log(message, channelId) {
		if (!message || channelId) return Error('Missing parameters!');

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