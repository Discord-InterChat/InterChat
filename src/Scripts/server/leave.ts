import { ChatInputCommandInteraction } from 'discord.js';
import { sendInFirst } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	execute: async (interaction: ChatInputCommandInteraction) => {
		const serverOpt = interaction.options.getString('server') as string;
		const reason = interaction.options.getString('reason');
		const notify = interaction.options.getBoolean('notify') ?? true; // if not set, default to true
		let server;

		try {
			server = await interaction.client.guilds.fetch(serverOpt);
		}
		catch (err) {
			await interaction.reply('I am not in that server.');
			return;
		}

		if (notify) {
			await sendInFirst(server,
				`I am leaving this server due to reason **${reason}**. Please contact the staff from the support server if you think that the reason is not valid.`,
			);
		}
		await server.leave();
		await interaction.reply(`I have left the server ${server.name} due to reason "${reason}".`);

		logger.info(`Left server ${server.name} due to reason \`${reason}\``);
	},
};
