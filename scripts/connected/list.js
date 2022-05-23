const { EmbedBuilder } = require('discord.js');
module.exports = {
	async execute(interaction, database) {
		const serverOpt = interaction.options.getString('type');

		if (serverOpt == 'server') displayServers();
		if (serverOpt == 'user') displayUsers();

		async function displayUsers() {
			await interaction.reply({ content: 'Coming soon!', ephemeral: true });
		}

		async function displayServers() {
			const connectedList = database.collection('connectedList');
			const searchCursor = await connectedList.find();
			const result = await searchCursor.toArray();
			const Embed = new EmbedBuilder()
				.setColor('#0x2F3136')
				.setAuthor({
					name: 'Connected Servers:',
					iconURL: interaction.client.user.avatarURL(),
				})
				.setDescription(`Displaying the current connected servers: **${result.length}**`);
			for (let i = 0; i < result.length; i++) {
				Embed.addFields([
					{
						name: result[i].serverName,
						value: `ID: ${result[i].serverId}\nChannel Name: **${result[i].channelName}** (\`${result[i].channelId}\`)`,
					},
				]);
			}
			interaction.reply({ embeds: [Embed] });
		}
	},
};
