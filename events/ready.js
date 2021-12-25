const logger = require('../logger');
const { sendInFirst } = require('../utils');
const { stripIndents } = require('common-tags');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		logger.info(`Logged in as ${client.user.tag}`);

		const commands = await client.application.commands.fetch();

		const blacklist = commands.find(command => command.name == 'blacklist');
		const badge = commands.find(command => command.name == 'badge');
		const logout = commands.find(command => command.name == 'logout');
		const leave = commands.find(command => command.name == 'leave');

		const allPermissions = [
			{
				id: blacklist.id,
				permissions: [{
					id: '800698916995203104',
					type: 'ROLE',
					permission: true,
				}],
			},
			{
				id: badge.id,
				permissions: [{
					id: '800698916995203104',
					type: 'ROLE',
					permission: true,
				}],
			},
			{
				id: logout.id,
				permissions: [{
					id: '800698916995203104',
					type: 'ROLE',
					permission: true,
				}],
			},
			{
				id: leave.id,
				permissions: [{
					id: '800698916995203104',
					type: 'ROLE',
					permission: true,
				}],
			},
		];

		const guilds = await client.guilds.fetch();
		for (const oauth2Guild of guilds) {
			const guild = await oauth2Guild[1].fetch();
			await guild.commands.permissions.set({ fullPermissions: allPermissions });
		}

		for (const guild of client.guilds.cache) {
			if (guild[1].memberCount < 1000) {
				await sendInFirst(guild[1],
					stripIndents`
					Hey!
					ChatBot has gone through a major update and is now ready to be used on a larger scale. The entire code has been rewritten from Python (discord.py) to JavaScript (discord.js). We haven't added any new features yet, except for this command (/updates).

					The staff team is planning to make a few major changes and here is what to expect in a few weeks to a few months:
					• Rebranding - The name 'ChatBot' leads users into thinking that this is an AI chatbot and it annoys both them and us. We have not yet decided a new name, but we will soon.
					• Anonymity Feature - Users or Servers may be sensitive about their names, so they may want to be anonymous. This may be available only for voters.
					• Inactivity - If a server is inactive for over a day, it will be removed from the database.
					• Premium - Voters will get the 'Premium' status which allows them to use certain features, including Anonymity.

					There are a few more things the staff are discussing about, but it is not certain whether they will be implemented or not.
					If you have any questions, feel free to contact us.

					BTW ChatBot has reached 300 servers, and it has been over 1 year since we got verified :partying_face: :partying_face:! So thank you for sticking with us this entire time!

					:christmas_tree: Merry Christmas :christmas_tree: and a :calendar_spiral: Happy New Year! :calendar_spiral:
					- The ChatBot Staff Team <a:staff:789764656549068820>
				`);
			}
		}

	},
};