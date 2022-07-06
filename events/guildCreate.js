const { MessageEmbed, Guild } = require('discord.js');
const { client } = require('../index');
const mongoUtil = require('../utils');
const { sendInFirst, colors } = require('../utils');
const { normal, icons } = require('../emoji.json');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const filter = require('leo-profanity');
dotenv.config();

module.exports = {
	name: 'guildCreate',
	/**
	 * @param {Guild} guild
	 * @returns
	 */
	async execute(guild) {
		const database = mongoUtil.getDb();
		const blacklistedServers = database.collection('blacklistedServers');

		const badword = filter.list().filter((name) => {return guild.name.includes(name);});

		if (badword[0]) {
			guild.fetchIntegrations()
				.then(async res => {
					const filtered = res.find(bot => {return bot.account.id === client.user.id;});
					const user = await client.users.fetch(filtered.user.id);
					try {
						await user.send(`Unfortunately, the name of the server **${guild.name}** violates the ChatBot guidelines, therefore I must leave until it is corrected.`);
					}
					catch {
						await sendInFirst(guild, 'Unfortunately, the name of this server violates the ChatBot guidelines, therefore I must leave until it is corrected.');
					}
					await guild.leave();
				})
				.catch(async () => {
					await sendInFirst(guild, 'Unfortunately, the name of this server violates the ChatBot guidelines, therefore I must leave until it is corrected.');
					await guild.leave();
				});
			return;
		}

		const serverInBlacklist = await blacklistedServers.findOne({ serverId: guild.id });
		if (serverInBlacklist) {
			await sendInFirst(guild, `This server is blacklisted in this bot for reason \`${serverInBlacklist.reason}\`. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
			await guild.leave();
			return;
		}

		const goalChannel = await client.channels.fetch('906460473065615403');
		await goalChannel.send(`${icons.join} I have joined ${guild.name}! ${500 - client.guilds.cache.size} to go!`);

		const embed = new MessageEmbed()
			.setTitle(`${normal.tada} Hi! Thanks for adding ChatBot to your server!`)
			.setDescription('To start chatting, make a channel and run `/network connect`!\n\nAnd if you are interested in the other commands use `/help`\n\nPS: There is only one main language supported by this bot, and that is English. You may be subject to disciplinary action if you don\'t follow it.\n\nNeed help? [Join the support server](https://discord.gg/6bhXQynAPs).\n**Please note that ChatBot is not AI, but a bot for chatting with other real discord servers.**')
			.setColor(colors('chatbot'));

		await sendInFirst(guild, { embeds: [embed] });
	},
};