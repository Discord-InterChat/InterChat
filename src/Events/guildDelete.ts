import { constants, getDb } from '../Utils/functions/utils';
import { Guild, TextChannel } from 'discord.js';


export default {
	name: 'guildDelete',
	async execute(guild: Guild) {
		const database = getDb();
		const connectedList = database?.connectedList;
		await connectedList?.deleteMany({ where: { serverId: guild.id } });

		const cbhq = guild.client.guilds.fetch(constants.mainGuilds.cbhq);
		const goalChannel = (await cbhq).channels.cache.get(constants.channel.goal);
		await (goalChannel as TextChannel)?.send({
			content: `${guild.client.emoji.icons.leave} I have been kicked from ${guild.name}. ${700 - guild.client.guilds.cache.size} to go!`,
			allowedMentions: { parse: ['everyone', 'roles'] },
		});
	},
};