import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import list from '../../Scripts/badge/list';

export default {
  staff: true,
  data: new SlashCommandBuilder()
    .setName('badge')
    .setDescription('Manage the badges for a user. Staff-only.')
    .setDefaultMemberPermissions('0')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a badge to a user')
        .addUserOption(userOption =>
          userOption
            .setName('user')
            .setRequired(true)
            .setDescription('The user to whom the badge should be added to'),
        )
        .addStringOption(stringOption =>
          stringOption
            .setName('badge')
            .setRequired(true)
            .setDescription('The badge to add')
            .addChoices(
              { name: 'Developer', value: 'Developer' },
              { name: 'Staff', value: 'Staff' },
              { name: 'Voter', value: 'Voter' },
              { name: 'Christmas2022', value: 'Christmas2022' },
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a badge from a user')
        .addUserOption(userOption =>
          userOption
            .setName('user')
            .setDescription('The user from whom the badge should be removed from')
            .setRequired(true),
        )
        .addStringOption(stringOption =>
          stringOption
            .setName('badge')
            .setDescription('The badge to remove')
            .setRequired(true)
            .addChoices(
              { name: 'Developer', value: 'Developer' },
              { name: 'Staff', value: 'Staff' },
              { name: 'Voter', value: 'Voter' },
              { name: 'Christmas2022', value: 'Christmas2022' },
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all badges for a user')
        .addUserOption(userOption =>
          userOption
            .setName('user')
            .setDescription('The user to list badges for')
            .setRequired(true),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);
    const badge = interaction.options.getString('badge');

    if (subcommand === 'list') {
      list.execute(interaction, user);
    }
    else {
      (await import(`../../Scripts/badge/${subcommand}`)).default.execute(interaction, user, badge);
    }
  },
};
