import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { connectedListInterface } from '../../Utils/typings/types';
import utils from '../../Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Shows the bot\'s statistics'),
	async execute(interaction: ChatInputCommandInteraction) {
		const uptime = utils.toHuman(interaction.client?.uptime as number);
		const database = utils.getDb();
		const connectedList = database?.collection('connectedList');
		const count = await connectedList?.countDocuments();
		const allConnected = await connectedList?.find({}).toArray();

		let connectedMembers = 0;
		for (const guildEntry of allConnected as connectedListInterface[]) {
			let guild;
			try {
				guild = await interaction.client.guilds.fetch(String(guildEntry.serverId));
			}
			catch {
				continue;
			}
			connectedMembers = connectedMembers + guild.memberCount;
		}


		const embed = new EmbedBuilder()
			.setAuthor({ name: `${interaction.client.user?.username} Statistics`, iconURL: interaction.client.user?.avatarURL() as string })
			.setColor(utils.colors())
			.addFields([
				{
					name: 'Uptime',
					value: uptime,
					inline: true,
				},
				{
					name: 'Memory Usage',
					value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB / 1 GB`,
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
					value: String(connectedMembers),
					inline: true,
				},
			]);
		await interaction.reply({ embeds: [embed] });
	},

};