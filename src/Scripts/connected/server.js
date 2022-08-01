const { EmbedBuilder } = require('discord.js');
const { getDb } = require('../../utils/functions/utils');
const { paginate } = require('../../utils/functions/paginator');
const emojis = require('../../utils/emoji.json');

module.exports = {
	async execute(interaction) {
		const database = getDb();
		const connectedList = database.collection('connectedList');
		const searchCursor = await connectedList.find();
		const result = await searchCursor.toArray();

		if (result.length === 0) return interaction.reply(`No connected servers yet ${emojis.normal.bruhcat}`);

		const embeds = [];
		let itemsPerPage = 5;

		for (let index = 0; index < result.length; index += 5) {
			const current = result.slice(index, itemsPerPage);

			let j = index;
			let l = index;
			itemsPerPage += 5;

			const fields = current.map(value => {
				return {
					name: `${++j}. ${value.serverName}`,
					value: `
					ServerID: ${value.serverId}
					Channel: ${value.channelName} \`(${value.channelId}\`)
					Compact Mode: ${value.compact ? 'Enabled' : 'Disabled'}
					`,
				};
			});

			const embed = new EmbedBuilder()
				.setDescription(`Showing the current connected servers: ${++l}-${j} / **${result.length}**`)
				.setColor(0x2F3136)
				.setFields(fields);
			embeds.push(embed);
		}

		return paginate(interaction, embeds);


	},
};