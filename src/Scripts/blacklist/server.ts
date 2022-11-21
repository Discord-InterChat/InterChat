import { PrismaClient } from '@prisma/client';
import { ChatInputCommandInteraction } from 'discord.js';
import { sendInFirst } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, database: PrismaClient) {
		const serverOpt = interaction.options.getString('server', true);
		const reason = interaction.options.getString('reason');
		const subCommandGroup = interaction.options.getSubcommandGroup();
		const blacklistedServers = database.blacklistedServers;
		const serverInBlacklist = await blacklistedServers.findFirst({
			where: { serverId: serverOpt },
		});

		if (subCommandGroup == 'add') {
			if (serverInBlacklist) return await interaction.reply('The server is already blacklisted.');

			let server;
			try {
				server = await interaction.client.guilds.fetch(String(serverOpt));
			}
			catch {
				interaction.reply('Something went wrong! Are you sure that was a valid server ID?');
				return;
			}
			await blacklistedServers.create({
				data: {
					serverName: server.name,
					serverId: serverOpt,
					reason: `${reason}`,
				},
			});

			await sendInFirst(
				server,
				`This server has been blacklisted from this bot for reason \`${reason}\`. Please join the support server and contact the staff to get whitelisted and/or if you think the reason is not valid.`,
			);
			await interaction.reply({
				content: `The server **${server.name}** has been blacklisted for reason \`${reason}\`.`,
			});
			await server.leave();
			modActions(interaction.user, {
				guild: { id: server.id, resolved: server },
				action: 'blacklistServer',
				timestamp: new Date(),
				reason,
			});
		}


		else if (subCommandGroup == 'remove') {
			if (!serverInBlacklist) return await interaction.reply('The server is not blacklisted.');
			await blacklistedServers.delete({ where: { serverId: serverOpt } });

			// Using name from DB since the bot isn't in the server, so it doesn't have any of its data.
			interaction.reply(`The server **${serverInBlacklist.serverName}** has been removed from the blacklist.`);


			modActions(interaction.user, {
				dbGuild: serverInBlacklist,
				action: 'unblacklistServer',
				timestamp: new Date(),
				reason,
			});
		}
	},
};
