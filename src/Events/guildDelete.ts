import { constants, getDb } from '../Utils/functions/utils';
import { Guild, TextChannel } from 'discord.js';
import { NetworkManager } from '../Structures/network';


export default {
	name: 'guildDelete',
	async execute(guild: Guild) {
		const database = getDb();
		await database.setup.deleteMany({ where: { guildId: guild.id } });
		new NetworkManager().disconnect({ serverId: guild.id });

		const cbhq = await guild.client.guilds.fetch(constants.mainGuilds.cbhq);
		const goalChannel = cbhq.channels.cache.get(constants.channel.goal) as TextChannel;
		await goalChannel?.send({
			content: `${guild.client.emoji.icons.leave} I have been kicked from ${guild.name}. ${700 - guild.client.guilds.cache.size} to go!`,
			allowedMentions: { parse: ['everyone', 'roles'] },
		});
	},
};