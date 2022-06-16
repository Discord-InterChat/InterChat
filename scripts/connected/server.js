/* eslint-disable no-inner-declarations */
const { MessageEmbed } = require('discord.js');
const { paginate } = require('../../utils');

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
			const connectedList = database.collection('connectedList');
			const searchCursor = await connectedList.find();
			const result = await searchCursor.toArray();
			// const Embed = new MessageEmbed()
			// 	.setColor('#0x2F3136')
			// 	.setAuthor({
			// 		name: 'Connected Servers:',
			// 		iconURL: interaction.client.user.avatarURL(),
			// 	})
			// 	.setDescription(`Displaying the current connected servers: **${result.length}**`);
			// for (let i = 0; i < result.length; i++) {
			// 	Embed.addFields([
			// 		{
			// 			name: result[i].serverName,
			// 			value: `${emoji.interaction.ID}: ${result[i].serverId}\n Channel: **${result[i].channelName}** (\`${result[i].channelId}\`)`,
			// 		},
			// 	]);
			// }

			function generateEmbed(db) {
				const embeds = [];
				let k = 5;

				for (let i = 0; i < db.length; i += 5) {
					const current = db.slice(i, k);

					let j = i;
					k += 5;

					const fields = current.map(value => { return { name: `${++j}. ${value.serverName}`, value: `ServerID: ${value.serverId}\nChannel: ${value.channelName} \`(${value.channelId})\`` }; });

					const embed = new MessageEmbed()
						.setDescription(`Showing the current connected servers: ${j}-${k >= result.length ? result.length : k} / **${result.length}**`)
						.setColor(0x2F3136)
						.setFields(fields);
					embeds.push(embed);
				}
				return embeds;
			}

			paginate(interaction, generateEmbed(result));

		}
	},
};
