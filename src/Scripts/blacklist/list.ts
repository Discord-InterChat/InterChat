import { PrismaClient } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, database: PrismaClient) {
		const serverOpt = interaction.options.getString('type');

		if (serverOpt == 'server') displayServers();
		else if (serverOpt == 'user') displayUsers();

		async function displayServers() {
			const result = await database.blacklistedServers.findMany();

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
			const result = await database.blacklistedUsers.findMany();

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
