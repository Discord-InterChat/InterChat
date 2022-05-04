// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageEmbed } = require('discord.js');
// const { colors } = require('../../utils');
// const mongoUtil = require('../../utils');
// module.exports = {
// 	data: new SlashCommandBuilder()
// 		.setName('stats')
// 		.setDescription('Shows the bot\'s statistics'),
// 	async execute(interaction) {
// 		await interaction.deferReply();
// 		const guilds = await interaction.client.guilds.fetch();
// 		// const guilds = await interaction.client.guilds.cache.size;
// 		let members;
// 		for (const oauth2Guild of guilds) {
// 			const guild = await oauth2Guild[1].fetch();
// 			const guildMembers = await guild.members.fetch();
// 			for (const member of guildMembers) {
// 				members = members + member;
// 			}
// 		}
// 		members = [...new Set(members)];

// 		const database = mongoUtil.getDb();
// 		const connectedList = database.collection('connectedList');
// 		const count = await connectedList.count({});
// 		// const allConnected = await connectedList.find().toArray();

// 		// let connectedMembers = 0;
// 		// for (const guildEntry of allConnected) {
// 		// 	const guild = await interaction.client.guilds.fetch(String(guildEntry.serverId));
// 		// 	connectedMembers = connectedMembers + guild.memberCount;
// 		// }

// 		const embed = new MessageEmbed()
// 			.setColor(colors())
// 			.addFields([
// 				{
// 					name: 'Uptime',
// 					value: `${Math.floor(process.uptime() / 60)} minutes`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Memory Usage',
// 					value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Ping',
// 					value: `${interaction.client.ws.ping}ms`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Guilds',
// 					value: `${guilds.size}`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Users',
// 					value: `${members.length}`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Commands',
// 					value: `${interaction.client.commands.size}`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Bot Version',
// 					value: `v${interaction.client.version}`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Discord.JS',
// 					value: `v${require('discord.js/package.json').version}`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Node.JS',
// 					value: `${process.version}`,
// 					inline: true,
// 				},
// 				{
// 					name: 'Connected Servers',
// 					value: '❌ Disabled Temporarily',
// 					inline: true,
// 				},
// 				{
// 					name: 'Connected Members',
// 					value: `${NaN}`,
// 					inline: true,
// 				},
// 			])
// 			.setAuthor(`${interaction.client.user.tag} Statistics`, interaction.client.user.avatarURL());
// 		await interaction.followUp({ embeds: [embed] });
// 	},

// };

const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { colors } = require('../../utils');
const mongoUtil = require('../../utils');
const os = require('os-utils');
const humanize = require('human-date');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Shows the bot\'s statistics'),
	async execute(interaction) {
		await interaction.deferReply();
		// let totalSeconds = (interaction.client.uptime / 1000);
		// const days = Math.floor(totalSeconds / 86400);
		// totalSeconds %= 86400;
		// const hours = Math.floor(totalSeconds / 3600);
		// totalSeconds %= 3600;
		// const minutes = Math.floor(totalSeconds / 60);
		// const seconds = Math.floor(totalSeconds % 60);
		// const uptime = `${days}d, ${hours}h, ${minutes}m ${seconds}s`;

		// const guilds = await interaction.client.guilds.fetch();
		// const guilds = await interaction.client.guilds.cache.size;

		// const members = [];
		// for (const oauth2Guild of guilds) {
		// 	const guild = await oauth2Guild[1].fetch();
		// 	const guildMembers = await guild.members.fetch();
		// 	for (const member of guildMembers) {
		// 		// members = members + member;
		// 		members.push(member);
		// 	}
		// }
		// members = [...new Set(members)];

		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');
		const count = await connectedList.count();
		const time = humanize.relativeTime(process.uptime(), { returnObject: true });
		console.log(time.seconds);

		// const allConnected = await connectedList.find({}).toArray();

		// let connectedMembers = 0;
		// for (const guildEntry of allConnected) {
		// 	const guild = await interaction.client.guilds.fetch(String(guildEntry.serverId));
		// 	connectedMembers = connectedMembers + guild.memberCount;
		// }

		const embed = new MessageEmbed()
			.setColor(colors())
			.addFields([
				{
					name: 'Uptime',
					// eslint-disable-next-line no-inline-comments
					value: humanize.relativeTime(process.uptime()), // `${Math.floor(process.uptime() / 60)} minutes`,
					inline: true,
				},
				{
					name: 'Memory Usage',
					// eslint-disable-next-line no-inline-comments
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
					value: `v${require('discord.js/package.json').version}`,
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
					value: 'nahh',
					// String(connectedMembers),
					inline: true,
				},
			])
			.setAuthor(`${interaction.client.user.username} Statistics`, interaction.client.user.avatarURL());
		await interaction.followUp({ embeds: [embed] });
	},

};