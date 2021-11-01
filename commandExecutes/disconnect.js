module.exports = {
	async execute(interaction, connectedList) {
		const findChannel = await connectedList.findOne({ channel_id: interaction.channel.id });
		if (findChannel) {
			await connectedList.deleteOne({ channel_id: interaction.channel.id });
			await interaction.reply('Disconnected from the network.');
		}
		else {
			await interaction.reply('You are not connected to the network.');
		}
	},
};