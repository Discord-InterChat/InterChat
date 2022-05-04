const logger = require('../logger');
// const { sendInFirst, colors } = require('../utils');
// const { stripIndents } = require('common-tags');
// const { MessageEmbed } = require('discord.js');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		client.user.setPresence({ status: '' });
		logger.info(`Logged in as ${client.user.tag}`);

		// 	const commands = await client.application.commands.fetch();

		// 	const blacklist = commands.find(command => command.name == 'blacklist');
		// 	const badge = commands.find(command => command.name == 'badge');
		// 	const logout = commands.find(command => command.name == 'logout');
		// 	const leave = commands.find(command => command.name == 'leave');

		// 	const allPermissions = [
		// 		{
		// 			id: blacklist.id,
		// 			permissions: [{
		// 				id: '800698916995203104',
		// 				type: 'ROLE',
		// 				permission: true,
		// 			}],
		// 		},
		// 		{
		// 			id: badge.id,
		// 			permissions: [{
		// 				id: '800698916995203104',
		// 				type: 'ROLE',
		// 				permission: true,
		// 			}],
		// 		},
		// 		{
		// 			id: logout.id,
		// 			permissions: [{
		// 				id: '800698916995203104',
		// 				type: 'ROLE',
		// 				permission: true,
		// 			}],
		// 		},
		// 		{
		// 			id: leave.id,
		// 			permissions: [{
		// 				id: '800698916995203104',
		// 				type: 'ROLE',
		// 				permission: true,
		// 			}],
		// 		},
		// 	];

	// 	const cbGuilds = await client.guilds.fetch();
	// 	const oauth2GuildCBHQ = cbGuilds.get('770256165300338709');
	// 	const cbHQ = await oauth2GuildCBHQ.fetch();
	// 	await cbHQ.commands.permissions.set({ fullPermissions: allPermissions });
	},
};