module.exports = {
	async execute(interaction, connectedList) {
		const findChannel = await connectedList.findOne({ channelId: interaction.channel.id });
		if (findChannel) {
			await connectedList.deleteOne({ channelId: interaction.channel.id });
			await interaction.reply('Disconnected from the network.');
		}
		else {
			await interaction.reply('You are not connected to the network.');
		}
	},
};