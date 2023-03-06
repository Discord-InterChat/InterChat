import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import reset from '../../Scripts/setup/reset';
import initialize from '../../Scripts/setup/initialize';
import displaySettings from '../../Scripts/setup/displaySettings';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Manage the chat network for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((subcommand) => subcommand.setName('reset').setDescription('Reset the setup for this server.'))
    .addSubcommand((subcommand) => subcommand.setName('edit').setDescription('Edit an already existing setup for this server.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Setup the InterChat Network.')
        .addChannelOption((channelOption) =>
          channelOption
            .setName('destination')
            .setDescription('Select the channel you wish to use as the Network.')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const database = getDb();
    const serverInBlacklist = await database.blacklistedServers.findFirst({ where: { serverId: interaction.guild?.id } });
    const userInBlacklist = await database.blacklistedUsers.findFirst({ where: { userId: interaction.user.id } });

    const subcommand = interaction.options.getSubcommand();

    if (serverInBlacklist) {
      await interaction.reply('This server is blacklisted from using the Chat Network.');
      return;
    }
    else if (userInBlacklist) {
      await interaction.reply('You have been blacklisted from using the Chat Network.');
      return;
    }

    switch (subcommand) {
      case 'reset': reset.execute(interaction); break;
      case 'edit': displaySettings.execute(interaction); break;
      default: initialize.execute(interaction);
    }
  },
};
