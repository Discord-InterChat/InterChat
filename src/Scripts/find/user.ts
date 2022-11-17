import Levels from 'discord-xp';
import { EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, ComponentType } from 'discord.js';
import { stripIndents } from 'common-tags';
import { checkIfStaff, colors, constants, getDb } from '../../Utils/functions/utils';

export = {
	async execute(interaction: ChatInputCommandInteraction, userId: string, hidden: boolean) {
		const user = await interaction.client.users.fetch(userId).catch(() => null);
		if (!user) return interaction.reply({ content: 'Unknown user.', ephemeral: true });

		const blacklistedUsers = getDb().blacklistedUsers;

		const components = async () => {
			const userInBlacklist = await blacklistedUsers?.findFirst({ where: { userId: user.id } });

			return new ActionRowBuilder<ButtonBuilder>({
				components: [
					new ButtonBuilder({
						customId: `${userInBlacklist ? 'unblacklist' : 'blacklist'}`,
						label: `${userInBlacklist ? 'Unblacklist' : 'Blacklist'}`,
						style: userInBlacklist ? ButtonStyle.Success : ButtonStyle.Danger,
					}),
				],
			});
		};

		const userEmbed = await interaction.reply({
			content: user.id,
			embeds: [await embedGen(user)],
			components: [await components()],
			ephemeral: hidden,
		});

		const collector = userEmbed.createMessageComponentCollector({
			filter: async (i) => i.user.id === interaction.user.id && await checkIfStaff(i.client, i.user),
			componentType: ComponentType.Button,
		});

		collector.on('collect', async (i) => {
			switch (i.customId) {
			case 'blacklist':
				await blacklistedUsers?.create({
					data: {
						username: `${user.username}#${user.discriminator}`,
						userId: user.id,
						reason: 'Some Reason',
						notified: true,
					},

				});
				await i.update({ embeds: [await embedGen(user)], components: [await components()] });
				i.followUp({ content: 'User blacklisted.', ephemeral: hidden });
				break;
			case 'unblacklist':
				await blacklistedUsers?.delete({ where: { userId: user.id } });
				await i.update({ embeds: [await embedGen(user)], components: [await components()] });
				i.followUp({ content: 'User removed from blacklist.', ephemeral: hidden });
				break;
			default:
				break;
			}
		});
	},
};

async function embedGen(user: User) {
	const userInBlacklist = await getDb().blacklistedUsers?.findFirst({ where: { userId: user.id } });

	const owns = user.client.guilds.cache
		.filter((guild) => guild.ownerId == user.id)
		.map((guild) => guild.name);

	const level = (await Levels.fetch(user.id, constants.mainGuilds.cbhq)).level;
	const { icons } = user.client.emoji;

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
}