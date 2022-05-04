const { SlashCommandBuilder } = require('@discordjs/builders');
const logger = require('../../logger');
const { sendInFirst } = require('../../utils');

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
		let guild;
		let member;
		try {
			guild = await interaction.client.guilds.fetch('969920027421732874');
			member = await guild.members.fetch(interaction.user.id);
		}
		catch {
			return interaction.reply('You do not have permissions to use this command.');
		}
		const roles = await member._roles;
		const staff = '970713237748318268';

		if (roles.includes(staff)) {
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

			await interaction.reply(`I have left the server ${server.name} due to reason "${reason}".`);
			await sendInFirst(server, `I am leaving this server due to reason ${reason}. Please contact the staff from the support server if you think that the reason is not valid.`);
			logger.info(`Left server ${server.name} due to reason \`${reason}\``);
			await server.leave();
		}
		else {
			return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
		}
	},

};