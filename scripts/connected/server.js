const { MessageEmbed, CommandInteraction } = require('discord.js');
const { paginate } = require('../../utils');
const { normal } = require('../../emoji.json');

module.exports = {
	/**
	 * @param {CommandInteraction} interaction
	 */
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

			if (result.length === 0) return interaction.reply(`No connected servers yet ${normal.bruhcat} `);

			const embeds = [];
			let k = 5;

			for (let i = 0; i < result.length; i += 5) {
				const current = result.slice(i, k);

				let j = i;
				k += 5;

				const fields = current.map(value => { return { name: `${++j}. ${value.serverName}`, value: `ServerID: ${value.serverId}\nChannel: ${value.channelName} \`(${value.channelId})\`` }; });

				const embed = new MessageEmbed()
					.setDescription(`Showing the current connected servers: ${j}-${k >= result.length ? result.length : k} / **${result.length}**`)
					.setColor(0x2F3136)
					.setFields(fields);
				embeds.push(embed);
			}
			return paginate(interaction, embeds);
		}

	},
};
