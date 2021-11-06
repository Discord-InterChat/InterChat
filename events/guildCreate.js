const { MessageEmbed } = require('discord.js');
const { client } = require('../index');
const mongoUtil = require('../mongoUtil');
const { sendInFirst } = require('../utils');

module.exports = {
	name: 'guildCreate',
	async execute(guild) {
		const goalChannel = await client.channels.fetch('906460473065615403');
		await goalChannel.send(`I have joined ${guild.name} :smiley:! ${300 - client.guilds.cache.size} to go!`);

		const database = mongoUtil.getDb();
		const blacklistedServers = database.collection('blacklistedServers');

		const serverInBlacklist = await blacklistedServers.findOne({ server_id: guild.id });
		if (serverInBlacklist) {
			sendInFirst(guild, 'This server is blacklisted in this bot. Please join the support server and contact the staff to know the reason and/or get whitelisted.');
			return;
		}
		const embed = new MessageEmbed()
			.setTitle('<a:tada:771245416736882708> Hi! Thanks for adding ChatBot to your server! Please type in "/info" for help and information!')
			.setDescription('To start chatting, make a channel and run `/network connect`!\n\nAnd if you are interested in the other commands use `/info`\n\nNeed help? [Join the support server](https://discord.gg/qw9s8bJ).\n**Please note that ChatBot is not AI, but a bot for chatting with other real discord servers.**')
			.setColor('#5cb5f9');

		sendInFirst(guild, { embeds: [embed] });
	},
};