const { EmbedBuilder, Guild, AuditLogEvent } = require('discord.js');
const { sendInFirst, colors, getDb } = require('../utils/functions/utils');
const { normal, icons } = require('../utils/emoji.json');
const badwordsList = require('badwords-list');
const channelIds = require('../utils/discordIds.json');
const { stripIndents } = require('common-tags');
require('dotenv').config();

module.exports = {
	name: 'guildCreate',
	/**
	 *
	 * @param {Guild} guild
	 * @returns
	 */
	async execute(guild) {
		const database = getDb();
		const blacklistedServers = database.collection('blacklistedServers');
		const serverInBlacklist = await blacklistedServers.findOne({ serverId: guild.id });

		const badword = badwordsList.array.some(word => guild.name.toLowerCase().includes(word.toLowerCase()));

		if (serverInBlacklist) {
			await sendInFirst(guild,
				`This server is blacklisted in this bot for reason \`${serverInBlacklist.reason}\`. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`,
			);
			await guild.leave();
			return;
		}

		else if (badword) {
			return guild
				.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 })
				.then(async (fetchedAuditLogs) => {
					const filtered = fetchedAuditLogs.entries.find((bot) => bot.account.id === guild.client.user.id);
					const user = filtered.executor;
					try {
						await user.send(`The name of the server **${guild.name}** violates the ChatBot guidelines, therefore I must leave until it is corrected.`);
					}
					catch {
						await sendInFirst(guild,
							'The name of this server violates the ChatBot guidelines, therefore I must leave until it is corrected.',
						);
					}
					await guild.leave();
				})
				.catch(async () => {
					await sendInFirst(guild,
						'The name of this server violates the ChatBot guidelines, therefore I must leave until it is corrected.',
					);
					await guild.leave();
				});
		}

		else {
			const goalChannel = await guild.client.channels.fetch(channelIds.channel.goal);
			await goalChannel.send({
				content: `${icons.join} I have joined ${guild.name}! ${500 - guild.client.guilds.cache.size} to go!`,
				allowedMentions: { parse: ['everyone', 'roles'] },
			});

			const embed = new EmbedBuilder()
				.setTitle(`${normal.tada} Hi! Thanks for adding me to your server!`)
				.setDescription(stripIndents`
					To start chatting, make a channel and run \`/setup\`!

					And if you are interested in the other commands use \`/help\`

					**Please note that ChatBot is not AI, but a bot for chatting with other real discord servers.**
					*PS: English is the only language supported by this bot. Failure to follow it may result in disciplinary action.*

					Need help? [Join the support server](https://discord.gg/6bhXQynAPs).
					`,
				)
				.setColor(colors('invisible'));

			await sendInFirst(guild, { embeds: [embed] });
		}
	},
};
