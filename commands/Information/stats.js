const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const utils = require('../../utils');
const mongoUtil = require('../../utils');
const os = require('os-utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Shows the bot\'s statistics'),
	async execute(interaction) {

		const uptime = utils.toHuman(interaction.client);
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');
		const count = await connectedList.count();
		const allConnected = await connectedList.find({}).toArray();

		let connectedMembers = 0;
		for (const guildEntry of allConnected) {
			let guild;
			try {
				guild = await interaction.client.guilds.fetch(String(guildEntry.serverId));
			}
			catch {
				continue;
			}
			connectedMembers = connectedMembers + guild.memberCount;
		}


		let version = require('discord.js/package.json').version;
		version = version.split('-');
		version = version[version.length - 3];

		const embed = new EmbedBuilder()
			.setColor(utils.colors())
			.addFields([
				{
					name: 'Uptime',
					value: uptime,
					inline: true,
				},
				{
					name: 'Memory Usage',
					value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB / ${Math.round(os.totalmem() / 1024)} GB`,
					inline: true,
				},
				{
					name: 'Ping',
					value: `${interaction.client.ws.ping}ms`,
					inline: true,
				},
				{
					name: 'Guilds',
					value: `${interaction.client.guilds.cache.size}`,
					inline: true,
				},
				{
					name: 'Users',
					value: `${interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`,
					inline: true,
				},
				{
					name: 'Commands',
					value: `${interaction.client.commands.size}`,
					inline: true,
				},
				{
					name: 'Bot Version',
					value: `v${interaction.client.version}`,
					inline: true,
				},
				{
					name: 'Discord.JS',
					value: `v${version}`,
					inline: true,
				},
				{
					name: 'Node.JS',
					value: `${process.version}`,
					inline: true,
				},
				{
					name: 'Connected Servers',
					value: String(count),
					inline: true,
				},
				{
					name: 'Connected Members',
					value: String(connectedMembers),
					inline: true,
				},
			])
			.setAuthor({ name: `${interaction.client.user.username} Statistics`, iconURL: interaction.client.user.avatarURL() });
		await interaction.reply({ embeds: [embed] });
	},

};