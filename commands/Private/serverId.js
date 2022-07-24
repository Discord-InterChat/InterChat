const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('server id')
		.setType(ApplicationCommandType.Message),
	/**
		 *
		 * @param {import 'discord.js'.MessageContextMenuCommandInteraction} interaction
		 * @returns
		 */
	async execute(interaction) {
		const args = interaction.targetMessage;
		if (args.author.id != interaction.client.user.id) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });
		if (!args || !args.embeds[0] || !args.embeds[0].footer) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });

		const msgfooter = args.embeds[0].footer.text.split('┃');
		const serverId = msgfooter[msgfooter.length - 1];
		await interaction.reply({ content: serverId, ephemeral: true });
	},

};