import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('hub')
    .setDescription('...')
    // .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((subcommand) => subcommand.setName('browse').setDescription('Browse public hubs and join them.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a hub.')
        .addStringOption((channelOption) =>
          channelOption
            .setName('name')
            .setDescription('The name of the hub.')
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const database = getDb();
    const serverInBlacklist = await database.blacklistedServers.findFirst({ where: { serverId: interaction.guild?.id } });
    const userInBlacklist = await database.blacklistedUsers.findFirst({ where: { userId: interaction.user.id } });

    const subcommand = interaction.options.getSubcommand();

    if (serverInBlacklist) {
      await interaction.reply('This server is blacklisted from using the InterChat.');
      return;
    }
    else if (userInBlacklist) {
      await interaction.reply('You have been blacklisted from using InterChat.');
      return;
    }

    require(`../../Scripts/hub/${subcommand}`).default(interaction);
  },
};
