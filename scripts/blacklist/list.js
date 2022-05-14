const { EmbedBuilder } = require('discord.js');
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
			let str = '';
			for (let i = 0; i < result.length; i++) {
				console.log(`Name: ${result[i].serverName}\nID: ${result[i]._id}\nserverID: ${result[i].serverId}\nReason: ${result[i].reason}\n\n`);
				str = str + `**${result[i].serverName}:**\nID: ${result[i].serverId}\nReason: ${result[i].reason}\n\n`;
				// serverList.push(`**${result[i].serverName}:**\nID: ${result[i].serverId}\nReason: ${result[i].reason}\n\n`);
			}
			const Embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setAuthor({ name: 'Blacklisted Servers:', iconURL: interaction.client.user.avatarURL() })
				.setDescription(str || 'None');
			interaction.reply({ embeds: [Embed] });
		}

		else if (serverOpt == 'user') {
			const blacklistedServers = database.collection('blacklistedUsers');
			const searchCursor = await blacklistedServers.find();
			const result = await searchCursor.toArray();
			// const userList = [];
			let str1 = '';
			for (let i = 0; i < result.length; i++) {
				console.log(`Name: ${result[i].username}\nID: ${result[i]._id}\nUserID: ${result[i].userId}\nReason: ${result[i].reason}\n\n`);
				// userList.push(`**${result[i].username}:**\nID: ${result[i].userId}\nReason: ${result[i].reason}\n\n`);
				str1 = str1 + `**${result[i].username}:**\nID: ${result[i].userId}\nReason: ${result[i].reason}\n\n`;
			}
			console.log(interaction.client.user.avatarURL);
			const Embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setAuthor({ name: 'Blacklisted Users:', iconURL: interaction.client.user.avatarURL() })
				.setDescription(str1);

			// console.log(list);
			// console.log(str);

			interaction.reply({ embeds: [Embed] });
		}
	},
};