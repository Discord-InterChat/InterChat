import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export default {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Manage the chat network for this server.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('channel')
				.setDescription('Setup the ChatBot Network.')
				.addChannelOption((channelOption) =>
					channelOption
						.setName('destination')
						.setDescription('Channel you want to setup chatbot to, select a category to create a new channel for chatbot')
						.setRequired(true)
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildCategory,
							ChannelType.PublicThread,
							ChannelType.PrivateThread,
						),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('view')
				.setDescription('View and edit your setup.'),
		)

		.addSubcommand(subcommand =>
			subcommand
				.setName('reset')
				.setDescription('Reset the setup for this server.'),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const database = getDb();
		const serverInBlacklist = await database.blacklistedServers.findFirst({ where: { serverId: interaction.guild?.id } });
		const userInBlacklist = await database.blacklistedUsers.findFirst({ where: { userId: interaction.user.id } });

		const subcommand = interaction.options.getSubcommand();

		if (serverInBlacklist) {
			await interaction.reply(`This server is blacklisted from using the ChatBot Chat Network for reason \`${serverInBlacklist.reason}\`! Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
			return;
		}
		else if (userInBlacklist) {
			await interaction.reply('You have been blacklisted from using the ChatBot Chat Network.');
			return;
		}

		if (subcommand === 'view') {
			(await import('../../Scripts/setup/displayEmbed')).execute(interaction, database);
			return;
		}
		else if (subcommand === 'reset') {
			(await import('../../Scripts/setup/reset')).execute(interaction, database);
		}
		else {
			(await import('../../Scripts/setup/init')).execute(interaction, database).catch(logger.error);
		}
	},
};