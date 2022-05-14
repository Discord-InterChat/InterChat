const { EmbedBuilder } = require('discord.js');
const logger = require('../logger');
const mongoUtil = require('../utils');
const { colors } = require('../utils');
const { client } = require('../index');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		if (message.content.startsWith('c!help') || message.content.startsWith('c!connect') || message.content.startsWith('c!disconnect')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		if (channelInNetwork) {

			const userInBlacklist = await database.collection('blacklistedUsers').findOne({ userId: message.author.id });
			if (userInBlacklist) {
				await message.reply(`You are blacklisted from using the ChatBot Chat Network for reason \`${userInBlacklist.reason}\`! Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
				return;
			}

			if (message.content.includes('@everyone') || message.content.includes('@here')) {
				await message.channel.send('Haha good try, but you just pinged your own server 😆.');
				return;
			}

			if (message.content.includes('https://') || message.content.includes('http://')) {
				await message.channel.send('Haha good try, but the link you posted didn\'t get sent 😆.');
				return;
			}

			const allConnectedChannels = await connectedList.find({});
			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL({ dynamic: true }), url: `https://discord.com/users/${message.author.id}` })
				.setFooter({ text: `From: ${message.guild}┃${message.guild.id}`, iconURL: message.guild.iconURL({ dynamic: true }) })
				.addFields([
					{ name: 'Message', value: message.content, inline: false }]);

			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			try {
				await message.delete();
			}
			catch (err) {
				logger.error(err);
			}

			allConnectedChannels.forEach(async channelObj => {
				const channel = await client.channels.fetch(channelObj.channelId);
				await channel.send({ embeds: [embed] });
			});
		}
		else {
			return;
		}
	},
};