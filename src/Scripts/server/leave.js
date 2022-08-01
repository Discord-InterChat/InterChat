const { checkIfStaff, sendInFirst } = require('../../utils/functions/utils');
const logger = require('../../utils/logger');

module.exports = {
	execute: async (interaction) => {
		const perms = await checkIfStaff(interaction);
		if (perms === 0) return;

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
		await sendInFirst(
			server,
			`I am leaving this server due to reason **${reason}**. Please contact the staff from the support server if you think that the reason is not valid.`,
		);
		logger.info(`Left server ${server.name} due to reason \`${reason}\``);
		await server.leave();
	},
};
