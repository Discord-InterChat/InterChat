import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Db } from 'mongodb';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, database: Db) {
		const serverOpt = interaction.options.getString('type');

		if (serverOpt == 'server') displayServers();
		else if (serverOpt == 'user') displayUsers();

		async function displayServers() {
			const blacklistedServers = database.collection('blacklistedServers');
			const searchCursor = await blacklistedServers.find();
			const result = await searchCursor.toArray();
			const Embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setAuthor({
					name: 'Blacklisted Servers:',
					iconURL: interaction.client.user?.avatarURL()?.toString(),
				});
			for (let i = 0; i < result.length; i++) {
				Embed.addFields([
					{
						name: result[i].serverName,
						value: `${interaction.client.emoji.icons.id}: ${result[i].serverId}\nReason: ${result[i].reason}\n\n`,
					},
				]);
			}
			interaction.reply({ embeds: [Embed] });
		}


		async function displayUsers() {
			const blacklistedUsers = database.collection('blacklistedUsers');
			const searchCursor = await blacklistedUsers.find();
			const result = await searchCursor.toArray();
			const Embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setAuthor({
					name: 'Blacklisted Users:',
					iconURL: interaction.client.user?.avatarURL()?.toString(),
				});
			for (let i = 0; i < result.length; i++) {
				Embed.addFields([
					{
						name: result[i].username,
						value: `${interaction.client.emoji.icons.id}: ${result[i].userId}\nReason: ${result[i].reason}\n\n`,
					},
				]);
			}
			interaction.reply({ embeds: [Embed] });
		}
	},
};
