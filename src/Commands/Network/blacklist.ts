import { AutocompleteInteraction, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getDb } from '../../Utils/utils';

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
                  .setAutocomplete(true)
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
                .setAutocomplete(true)
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
                  .setAutocomplete(true)
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
                .setAutocomplete(true)
                .setRequired(true),
            )
            .addStringOption(server =>
              server
                .setName('server')
                .setDescription('The server to remove from the blacklist.')
                .setAutocomplete(true)
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
            .setAutocomplete(true)
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
    else if (!hubInDb.moderators.find(({ userId }) => userId === interaction.user.id) && hubInDb.ownerId !== interaction.user.id) {
      return await interaction.reply({
        content: 'You do not have the necessary permissions in the hub to use this command.',
        ephemeral: true,
      });
    }

    (await import(`../../Scripts/blacklist/${subCommand}`)).default.execute(interaction, hubInDb);
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const db = getDb();
    const action = interaction.options.getSubcommand() as 'user' | 'server';
    const focusedHub = interaction.options.get('hub');

    if (typeof focusedHub?.value !== 'string') return;

    if (focusedHub.focused) {
      const hub = await db.hubs.findMany({
        where: {
          name: { mode: 'insensitive', contains: focusedHub.value },
          OR: [
            { ownerId: interaction.user.id },
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
        take: 25,
      });

      const filtered = hub.map(({ name: hubName }) => ({ name: hubName, value: hubName }));
      return interaction.respond(filtered);
    }

    switch (action) {
      case 'user': {
        const userOpt = interaction.options.get('user');

        if (!userOpt?.focused || typeof userOpt.value !== 'string') return;

        const filteredUsers = await db.blacklistedUsers.findMany({
          where: {
            hub: {
              name: focusedHub.value,
              OR: [
                { ownerId: interaction.user.id },
                { moderators: { some: { userId: interaction.user.id } } },
              ],
            },
            OR: [
              { username: { mode: 'insensitive', contains: userOpt.value } },
              { userId: { mode: 'insensitive', contains: userOpt.value } },
            ],
          },
          take: 25,
        });

        const choices = filteredUsers.map((user) => { return { name: user.username, value: user.userId }; });
        interaction.respond(choices);
        break;
      }
      case 'server': {
        const serverOpt = interaction.options.get('server', true);

        if (!serverOpt.focused || typeof serverOpt.value !== 'string') return;

        const allServers = await db.blacklistedServers.findMany({
          where: {
            hub: {
              name: focusedHub.value,
              OR: [
                { ownerId: interaction.user.id },
                { moderators: { some: { userId: interaction.user.id } } },
              ],
            },
            OR: [
              { serverName: { mode: 'insensitive', contains: serverOpt.value } },
              { serverId: { mode: 'insensitive', contains: serverOpt.value } },
            ],
          },
          take: 25,
        });
        const choices = allServers.map(({ serverName, serverId }) => { return { name: serverName, value: serverId }; });
        await interaction.respond(choices);
        break;
      }
    }
  },
};
