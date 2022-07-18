const { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType } = require('discord.js');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('user id')
		.setType(ApplicationCommandType.Message),
	/**
		 *
		 * @param {MessageContextMenuCommandInteraction} interaction
		 * @returns
		 */
	async execute(interaction) {
		const args = await interaction.channel.messages.cache.get(interaction.targetId);
		if (args.author.id != interaction.client.user.id) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });
		if (!args || !args.embeds[0] || !args.embeds[0].author || !args.embeds[0].author.url) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });

		const msgAuthor = args.embeds[0].author.url.split('/');
		const userId = msgAuthor[msgAuthor.length - 1];

		await interaction.reply({ content: userId, ephemeral: true });
	},

};