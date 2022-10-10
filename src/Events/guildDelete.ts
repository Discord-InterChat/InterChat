import utils from '../Utils/functions/utils';
import { Guild, TextChannel } from 'discord.js';


export default {
	name: 'guildDelete',
	async execute(guild: Guild) {
		const database = utils.getDb();
		const connectedList = database?.collection('connectedList');
		connectedList?.deleteOne({ serverId: guild.id });

		const cbhq = guild.client.guilds.fetch(utils.constants.mainGuilds.cbhq);
		const goalChannel = (await cbhq).channels.cache.get(utils.constants.channel.goal);
		await (goalChannel as TextChannel)?.send({
			content: `${guild.client.emoji.icons.leave} I have been kicked from ${guild.name}. ${600 - guild.client.guilds.cache.size} to go!`,
			allowedMentions: { parse: ['everyone', 'roles'] },
		});
	},
};