const { SlashCommandBuilder } = require('@discordjs/builders');
const logger = require('../../logger');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leave')
		.setDescription('Leaves the specified server. Staff-only.')
		.addStringOption(stringOption =>
			stringOption
				.setName('server')
				.setDescription('The server to leave.')
				.setRequired(true),
		)
		.addStringOption(stringOption =>
			stringOption
				.setName('reason')
				.setDescription('The reason for leaving the server.')
				.setRequired(true),
		),
	async execute(interaction) {
		const serverOpt = interaction.options.getString('server');
		const reason = interaction.options.getString('reason');
		let server;
		try {
			server = await interaction.client.guilds.fetch(serverOpt);
		}
		catch (err) {
			await interaction.reply('I am not in that server.');
			return;
		}

		try {
			await server.systemChannel.send(`I am leaving this server due to reason "${reason}".`);
		}
		catch (err) {
			logger.error(err);
		}

		await interaction.reply(`I have left the server ${server.name} due to reason "${reason}".`);
		await server.leave();
	},

};