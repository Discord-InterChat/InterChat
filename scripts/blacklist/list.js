const { EmbedBuilder } = require('discord.js');
const emoji = require('../../emoji.json');
module.exports = {
	async execute(interaction, database) {
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
					iconURL: interaction.client.user.avatarURL(),
				});
			for (let i = 0; i < result.length; i++) {
				Embed.addFields([
					{
						name: result[i].serverName,
						value: `${emoji.icons.id}: ${result[i].serverId}\nReason: ${result[i].reason}\n\n`,
					},
				]);
			}
			interaction.reply({ embeds: [Embed] });
		}
		async function displayUsers() {
			const blacklistedServers = database.collection('blacklistedUsers');
			const searchCursor = await blacklistedServers.find();
			const result = await searchCursor.toArray();
			const Embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setAuthor({
					name: 'Blacklisted Users:',
					iconURL: interaction.client.user.avatarURL(),
				});
			for (let i = 0; i < result.length; i++) {
				Embed.addFields([
					{
						name: result[i].username,
						value: `${emoji.icons.id}: ${result[i].userId}\nReason: ${result[i].reason}\n\n`,
					},
				]);
			}
			interaction.reply({ embeds: [Embed] });
		}
	},
};
