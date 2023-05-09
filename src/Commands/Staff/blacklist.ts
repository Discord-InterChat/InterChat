import { AutocompleteInteraction, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist a user or server from using the bot. Staff-only')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName('add')
        .setDescription('Add blacklist')
        .addSubcommand(
          subcommand =>
            subcommand
              .setName('user')
              .setDescription('Blacklist a user from using the bot. Staff-only')
              .addStringOption(hubOption =>
                hubOption
                  .setName('hub')
                  .setDescription('The name of the hub to blacklist the user from.')
                  .setRequired(true),
              )
              .addStringOption(user =>
                user
                  .setName('user')
                  .setDescription('The user ID to blacklist. User tag also works if they are already cached.')
                  .setRequired(true))
              .addStringOption(string =>
                string
                  .setName('reason')
                  .setDescription('The reason for blacklisting the user.')
                  .setRequired(true))
              .addNumberOption(option => option
                .setName('minutes')
                .setDescription('The number of minutes the user will be blakclisted for.')
                .setMinValue(1))
              .addNumberOption(option => option
                .setName('hours')
                .setDescription('The number of hours the user will be blacklisted for.'))
              .addNumberOption(option => option
                .setName('days')
                .setDescription('The number of hours the user will be blacklisted for.')),
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('server')
            .setDescription('Blacklist a server from using the bot. Staff-only')
            .addStringOption(hubOption =>
              hubOption
                .setName('hub')
                .setDescription('The name of the hub to blacklist the user from.')
                .setRequired(true),
            )
            .addStringOption(server =>
              server
                .setName('server')
                .setDescription('The server ID to blacklist.')
                .setRequired(true),
            )
            .addStringOption(string =>
              string
                .setName('reason')
                .setDescription('The reason for blacklisting the server.')
                .setRequired(true),
            )
            .addNumberOption(option => option
              .setName('minutes')
              .setDescription('The number of minutes the user will be blakclisted for.')
              .setMinValue(1))
            .addNumberOption(option => option
              .setName('hours')
              .setDescription('The number of hours the user will be blacklisted for.'))
            .addNumberOption(option => option
              .setName('days')
              .setDescription('The number of hours the user will be blacklisted for.')),
        ),
    )
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName('remove')
        .setDescription('Remove blacklist')
        .addSubcommand(
          subcommand =>
            subcommand
              .setName('user')
              .setDescription('Remove a user from the blacklist. Staff-only')
              .addStringOption(hubOption =>
                hubOption
                  .setName('hub')
                  .setDescription('The name of the hub to blacklist the user from.')
                  .setRequired(true),
              )
              .addStringOption(user =>
                user
                  .setName('user')
                  .setDescription('The user to remove from the blacklist. User tag also works.')
                  .setAutocomplete(true)
                  .setRequired(true),
              )
              .addStringOption(string =>
                string
                  .setName('reason')
                  .setDescription('The reason for blacklisting the server.'),
              ),
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('server')
            .setDescription('Remove a server from the blacklist.')
            .addStringOption(hubOption =>
              hubOption
                .setName('hub')
                .setDescription('The name of the hub to blacklist the user from.')
                .setRequired(true),
            )
            .addStringOption(server =>
              server
                .setName('server')
                .setDescription('The server to remove from the blacklist.')
                .setRequired(true),
            )
            .addStringOption(string =>
              string
                .setName('reason')
                .setDescription('The reason for blacklisting the server.'),
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all blacklists.')
        .addStringOption(hubOption =>
          hubOption
            .setName('hub')
            .setDescription('The name of the hub to blacklist the user from.')
            .setRequired(true),
        )
        .addStringOption(string =>
          string
            .setName('type')
            .setDescription('The type of blacklist to list.')
            .setRequired(true)
            .addChoices(
              { name: 'User', value: 'user' },
              { name: 'Server', value: 'server' }),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subCommand = interaction.options.getSubcommand();
    const hub = interaction.options.getString('hub', true);

    const db = getDb();
    const hubInDb = await db.hubs.findFirst({ where: { name: hub } });

    if (!hubInDb) {
      return await interaction.reply({
        content: 'Unknown hub.',
        ephemeral: true,
      });
    }
    else if (!hubInDb.moderators.find(({ userId }) => userId === interaction.user.id) && hubInDb.owner.userId !== interaction.user.id) {
      return await interaction.reply({
        content: 'You do not have the necessary permissions in the hub to use this command.',
        ephemeral: true,
      });
    }

    require(`../../Scripts/blacklist/${subCommand}`).execute(interaction, hubInDb);
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const action = interaction.options.getSubcommand() as 'user' | 'server';

    const focusedValue = interaction.options.getFocused().toLowerCase();
    let choices;

    switch (action) {
      case 'user': {
        const allUsers = await getDb().blacklistedUsers.findMany();
        choices = allUsers.map((user) => { return { name: user.username, value: user.userId }; });
        break;
      }
      case 'server': {
        const allServers = await getDb().blacklistedServers.findMany();
        choices = allServers.map((server) => { return { name: server.serverName, value: server.serverId }; });
        break;
      }
    }

    const filtered = choices
      .filter((choice) => choice.name.toLowerCase().includes(focusedValue) || choice.value.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    interaction.respond(filtered);
  },
};
