import Levels from 'discord-xp';
import { EmbedBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { stripIndents } from 'common-tags';
import { colors, constants, getDb } from '../../Utils/functions/utils';


export = {
	async execute(interaction: ChatInputCommandInteraction, userId: string, hidden: boolean) {
		const fetchedUser = await interaction.client.users.fetch(userId).catch(console.log);
		if (!fetchedUser) return interaction.reply({ content: 'Unknown user.', ephemeral: true });

		return await interaction.reply({
			content: fetchedUser.id,
			embeds: [await embedGen(fetchedUser)],
			ephemeral: hidden,
		});

	},
};


const embedGen = async (user: User) => {
	const { icons } = user.client.emoji;

	const owns = user.client.guilds.cache.filter((guild) => guild.ownerId == user.id).map((guild) => guild.name);
	const level = (await Levels.fetch(user.id, constants.mainGuilds.cbhq)).level;
	const userInBlacklist = await getDb()?.collection('blacklistedUsers').findOne({ userId: user.id });

	return new EmbedBuilder()
		.setAuthor({ name: user.tag, iconURL: user.avatarURL()?.toString() })
		.setColor(colors('invisible'))
		.setImage(user.bannerURL({ size: 1024 }) || null)
		.setThumbnail(user.avatarURL())
		.addFields([
			{
				name: 'User',
				value: stripIndents`
				> ${icons.mention} **Tag:** ${user.tag}
				> ${icons.id} **ID:** ${user.id}
				> ${icons.members} **Created:** <t:${Math.round(user.createdTimestamp / 1000)}:R>
				> ${icons.bot} **Bot:** ${user.bot}`,
			},

			{
				name: 'Network',
				value: stripIndents`
				> ${icons.activities} **Level**: ${level || 0}
				> ${icons.owner} **Owns:** ${owns.length > 0 ? owns.join(', ') : 'None'}
				> ${icons.delete} **Blacklisted:** ${userInBlacklist ? 'Yes' : 'No'}`,
			},
		]);
};