import { EmbedBuilder, ChatInputCommandInteraction, Guild, User, GuildMember } from 'discord.js';
import { stripIndents } from 'common-tags';
import emojis from '../../Utils/emoji.json';
import { getDb } from '../../Utils/functions/utils';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, option: string) {
		await interaction.deferReply({ ephemeral: true });
		const foundByID: Guild | undefined = interaction.client.guilds.cache.get(option);

		if (!foundByID) return interaction.followUp('Unknown Server.');

		const server = foundByID;
		const owner = await server?.fetchOwner();
		interaction.followUp({
			content: server?.id,
			embeds: [await embedGen(server, owner)],
			ephemeral: true,
		});
		return;

	},
};

async function embedGen(guild: Guild | undefined, GuildOwner: GuildMember | undefined) {
	const database = getDb();
	const collection = database?.collection('connectedList');
	const guildInDb = await collection?.findOne({ serverId: guild?.id });
	return new EmbedBuilder()
		.setAuthor({ name: String(guild?.name), iconURL: guild?.iconURL()?.toString() })
		.setColor('#2F3136')
		.addFields([
			{
				name: 'Server Info',
				value: stripIndents`\n
						${emojis.icons.owner} **Owner:** ${GuildOwner?.user.tag} (${GuildOwner?.id})
						${emojis.icons.members} **Member Count:** ${guild?.memberCount}`,
			},
			{
				name: 'Network Info',
				value: stripIndents`\n
						${guildInDb ? emojis.icons.connect : emojis.icons.disconnect} **Connected: ${guildInDb ? 'Yes' : 'No'}**
						${emojis.normal.clipart} **Channel(s): ${guildInDb?.channelName || 'Not Connected'} (\`${guildInDb?.channelId || ':('}\`)**`,
			},
		]);
}

