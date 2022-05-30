const { MessageEmbed } = require('discord.js');
const { staffPermissions } = require('../../utils');
const emoji = require('../../emoji.json');
module.exports = {
	async execute(interaction, database) {
		const serverOpt = interaction.options.getString('type');

		if (serverOpt == 'server') displayServers();
		if (serverOpt == 'user') displayUsers();

		async function displayUsers() {
			await interaction.reply({ content: 'Coming soon!', ephemeral: true });
		}

		async function displayServers() {
			// make this staff only [bug]
			const roles = await staffPermissions(interaction);
			if (roles.includes('staff')) {
				const connectedList = database.collection('connectedList');
				const searchCursor = await connectedList.find();
				const result = await searchCursor.toArray();
				const Embed = new MessageEmbed()
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
							value: `${emoji.interaction.ID}: ${result[i].serverId}\n Channel: **${result[i].channelName}** (\`${result[i].channelId}\`)`,
						},
					]);
				}
				interaction.reply({ embeds: [Embed] });
			}
		}
	},
};
