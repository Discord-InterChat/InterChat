const { ContextMenuCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('server id')
		.setType(3),
	async execute(interaction) {
		const args = await interaction.channel.messages.cache.get(interaction.targetId);
		if (args.author.id != interaction.client.user.id) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });
		if (!args || !args.embeds[0] || !args.embeds[0].footer) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });

		const msgfooter = args.embeds[0].footer.text.split('┃');
		const serverId = msgfooter[msgfooter.length - 1];
		await interaction.reply({ content: serverId, ephemeral: true });
	},

};