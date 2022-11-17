import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb, getGuildName } from '../../Utils/functions/utils';
import { paginate } from '../../Utils/functions/paginator';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction) {
		const database = getDb();
		const result = await database.connectedList.findMany();

		if (!result || result?.length === 0) return interaction.reply(`No connected servers yet ${interaction.client.emoji.normal.bruhcat}`);

		const embeds: EmbedBuilder[] = [];
		let itemsPerPage = 5;

		for (let index = 0; index < result.length; index += 5) {
			const current = result?.slice(index, itemsPerPage);

			let j = index;
			let l = index;
			itemsPerPage += 5;

			const fields = current.map(value => {
				const serverName = getGuildName(interaction.client, value.serverId);
				const channelName = interaction.client.channels.cache.get(value.channelId);

				return {
					name: `${++j}. ${serverName}`,
					value: `ServerID: ${value.serverId}\nChannel: ${channelName} \`(${value.channelId}\`)`,
				};
			});

			embeds.push(
				new EmbedBuilder()
					.setDescription(`Showing the current connected servers: ${++l}-${j} / **${result.length}**`)
					.setColor(0x2F3136)
					.setFields(fields),
			);
		}

		return paginate(interaction, embeds);
	},
};