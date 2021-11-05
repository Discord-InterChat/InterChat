const { MessageEmbed } = require('discord.js');
const logger = require('../logger');
const mongoUtil = require('../mongoUtil');
const { colors } = require('../utils');
const { client } = require('../index');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		if (message.content.startsWith('c!help')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		const channelInNetwork = await connectedList.findOne({ channel_id: message.channel.id });

		if (channelInNetwork) {
			if (message.content.includes('@everyone') || message.content.includes('@here')) {
				await message.channel.send('Haha good try, but you just pinged your own server 😆.');
				return;
			}

			if (message.content.includes('https://') || message.content.includes('http://')) {
				await message.channel.send('Haha good try, but the link you posted didn\'t get sent 😆.');
				return;
			}

			const allConnectedChannels = await connectedList.find({});
			const embed = new MessageEmbed()
				.setTimestamp()
				.setColor(colors())
				.setAuthor(message.author.tag, message.author.avatarURL({ dynamic: true }), `https://discord.com/users/${message.author.id}`)
				.setFooter(`From: ${message.guild}┃${message.guild.id}`, message.guild.iconURL({ dynamic: true }))
				.addField('Message', message.content, false);

			await require('../executes/message/addBadges').execute(message, database, embed);
			await require('../executes/message/messageContentModifiers').execute(message, embed);

			try {
				await message.delete();
			}
			catch (err) {
				logger.log('error', err);
			}

			allConnectedChannels.forEach(async channelObj => {
				const channel = await client.channels.fetch(channelObj.channel_id);
				await channel.send({ embeds: [embed] });
			});
		}
		else {
			return;
		}
	},
};