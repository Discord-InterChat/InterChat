import { EmbedBuilder, AuditLogEvent, Guild, TextChannel } from 'discord.js';
import { sendInFirst, colors, getDb, constants } from '../Utils/functions/utils';
import badwordsList from 'badwords-list';
import { stripIndents } from 'common-tags';
import { config } from 'dotenv';
config();

export default {
	name: 'guildCreate',
	async execute(guild: Guild) {
		const database = getDb();
		const blacklistedServers = database?.collection('blacklistedServers');
		const serverInBlacklist = await blacklistedServers?.findOne({ serverId: guild.id });

		const badword = badwordsList.array.some((word: string) => { return guild.name.toLowerCase().includes(word.toLowerCase()) === true;});

		const { normal, icons } = guild.client.emoji;

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
					const filtered = fetchedAuditLogs.entries.find((bot) => bot.target?.id === guild.client.user?.id);
					const user = filtered?.executor;
					try {
						await user?.send(`The name of the server **${guild.name}** violates the ChatBot guidelines, therefore I must leave until it is corrected.`);
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
			const goalChannel = guild.client.channels.cache.get(constants.channel.goal) as TextChannel;
			goalChannel?.send({
				content: `${icons.join} I have joined ${guild.name}! ${500 - guild.client.guilds.cache.size} to go!`,
				allowedMentions: { parse: ['everyone', 'roles'] },
			});

			const embed = new EmbedBuilder()
				.setTitle(`${normal.tada} Hi! Thanks for adding me to your server!`)
				.setDescription(stripIndents`
				To start chatting, make a channel and run </setup:978303442684624928>!

				And if you are interested in the other commands use \`/help\`.
				
				**Please note that ChatBot is not AI, but a bot for chatting with other real discord servers.**
				
				Need help? [Join the support server](https://discord.gg/6bhXQynAPs).`)
				.setFooter({ text: 'PS: English is the only language supported by this bot. Those who don\'t adhere to it may be kicked from the network.' })
				.setColor(colors('invisible'));

			await sendInFirst(guild, { embeds: [embed] });
		}
	},
};
