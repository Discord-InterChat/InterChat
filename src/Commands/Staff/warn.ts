import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export default {
  staff: true,
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user. Staff-only')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Warn a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to warn. Use their ID if they are not in the server.')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('The reason for the warning.').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a warning from a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to remove a warning from. Use their ID if they are not in the server.')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('The warning id. Use /listwarns to see the list of ids.')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('The reason for removing the warning.')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('Clear all warnings for a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription(
              'The user to clear warnings for. Use their ID if they are not in the server.',
            )
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('The reason for clearing the warnings.')
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction: ChatInputCommandInteraction) {
    // const subcommand = interaction.options.getSubcommand();
    // require('../../Scripts/warn/' + subcommand).execute(interaction);
    // disabled until strike system is implemented
    return interaction.reply('This command is currently disabled.');
  },
};
