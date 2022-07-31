const { EmbedBuilder } = require('discord.js');
const { sendInFirst, colors, getDb } = require('../utils/functions/utils');
const { normal, icons } = require('../utils/emoji.json');
const filter = require('leo-profanity');
const channelIds = require('../utils/discordIds.json');
require('dotenv').config();

module.exports = {
	name: 'guildCreate',
	async execute(guild) {
		const database = getDb();
		const blacklistedServers = database.collection('blacklistedServers');
		const serverInBlacklist = await blacklistedServers.findOne({ serverId: guild.id });

		const badword = filter.list().filter((name) => {
			return guild.name.includes(name);
		});


		if (serverInBlacklist) {
			await sendInFirst(
				guild,
				`This server is blacklisted in this bot for reason \`${serverInBlacklist.reason}\`. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`,
			);
			await guild.leave();
			return;
		}

		else if (badword[0]) {
			return guild
				.fetchIntegrations()
				.then(async (res) => {
					const filtered = res.find((bot) => {
						return bot.account.id === guild.client.user.id;
					});
					const user = await guild.client.users.fetch(filtered.user.id);
					try {
						await user.send(
							`Unfortunately, the name of the server **${guild.name}** violates the ChatBot guidelines, therefore I must leave until it is corrected.`,
						);
					}
					catch {
						await sendInFirst(
							guild,
							'Unfortunately, the name of this server violates the ChatBot guidelines, therefore I must leave until it is corrected.',
						);
					}
					await guild.leave();
				})
				.catch(async () => {
					await sendInFirst(
						guild,
						'Unfortunately, the name of this server violates the ChatBot guidelines, therefore I must leave until it is corrected.',
					);
					await guild.leave();
				});
		}

		else {
			const goalChannel = await guild.client.channels.fetch(channelIds.channel.goal); // REVIEW Import from config
			await goalChannel.send(
				`${icons.join} I have joined ${guild.name}! ${
					500 - guild.client.guilds.cache.size
				} to go!`,
			);

			const embed = new EmbedBuilder()
				.setTitle(`${normal.tada} Hi! Thanks for adding ChatBot to your server!`)
				.setDescription(
					'To start chatting, make a channel and run `/network connect`!\n\nAnd if you are interested in the other commands use `/help`\n\nPS: There is only one main language supported by this bot, and that is English. You may be subject to disciplinary action if you don\'t follow it.\n\nNeed help? [Join the support server](https://discord.gg/6bhXQynAPs).\n**Please note that ChatBot is not AI, but a bot for chatting with other real discord servers.**',
				)
				.setColor(colors('chatbot'));

			await sendInFirst(guild, { embeds: [embed] });
		}
	},
};
