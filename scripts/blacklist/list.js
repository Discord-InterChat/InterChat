const { MessageEmbed } = require('discord.js');
module.exports = {
	async execute(interaction, database) {
		// eslint-disable-next-line no-unused-vars
		const subCommand = interaction.options.getSubcommand();
		const serverOpt = interaction.options.getString('type');
		// console.log(serverOpt);
		// console.log(subCommand);

		if (serverOpt == 'server') {
			const blacklistedServers = database.collection('blacklistedServers');
			const searchCursor = await blacklistedServers.find();
			const result = await searchCursor.toArray();
			// const serverList = [];
			const Embed = new MessageEmbed();
			for (let i = 0; i < result.length; i++) {
				console.log(`Name: ${result[i].serverName}\nID: ${result[i]._id}\nserverID: ${result[i].serverId}\nReason: ${result[i].reason}\n\n`);
				Embed.addFields([{ name: result[i].serverName, value: `ID: ${result[i].serverId}\nReason: ${result[i].reason}\n\n` }]);
			}
			Embed.setColor('#0099ff');
			Embed.setAuthor({ name: 'Blacklisted Servers:', iconURL: interaction.client.user.avatarURL() });
			interaction.reply({ embeds: [Embed] });
		}

		else if (serverOpt == 'user') {
			const blacklistedServers = database.collection('blacklistedUsers');
			const searchCursor = await blacklistedServers.find();
			const result = await searchCursor.toArray();
			// const userList = [];
			const Embed = new MessageEmbed();
			for (let i = 0; i < result.length; i++) {
				console.log(`Name: ${result[i].username}\nID: ${result[i]._id}\nUserID: ${result[i].userId}\nReason: ${result[i].reason}\n\n`);
				Embed.addFields([{ name: result[i].username, value: `ID: ${result[i].userId}\nReason: ${result[i].reason}\n\n` }]);
			}
			Embed.setColor('#0099ff');
			Embed.setAuthor({ name: 'Blacklisted Users:', iconURL: interaction.client.user.avatarURL() });
			interaction.reply({ embeds: [Embed] });
		}
	},
};