const { sendInFirst } = require('../../utils/functions/utils');
const logger = require('../../utils/logger');

module.exports = {
	execute: async (interaction) => {
		const serverOpt = interaction.options.getString('server');
		const reason = interaction.options.getString('reason');
		let notify = interaction.options.getBoolean('notify');
		let server;
		notify ??= true; // if not set, default to true

		try {
			server = await interaction.client.guilds.fetch(serverOpt);
		}
		catch (err) {
			await interaction.reply('I am not in that server.');
			return;
		}

		await interaction.reply(`I have left the server ${server.name} due to reason "${reason}".`);

		if (notify) {
			await sendInFirst(server,
				`I am leaving this server due to reason **${reason}**. Please contact the staff from the support server if you think that the reason is not valid.`,
			);
		}
		await server.leave();
		logger.info(`Left server ${server.name} due to reason \`${reason}\``);
	},
};
