import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, AutocompleteInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('hub')
    .setDescription('...')
    // .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((subcommand) => subcommand
      .setName('browse')
      .setDescription('🔍 Browse publicly listed hubs on InterChat!')
      .addStringOption(stringOption =>
        stringOption
          .setName('search')
          .setDescription('Search for a hub by name.')
          .setAutocomplete(true)
          .setRequired(false),
      )
      .addStringOption(stringOption =>
        stringOption
          .setName('sort')
          .setDescription('Sort the hubs by a specific category.')
          .addChoices(
            { name: 'Most Active', value: 'active' },
            { name: 'Most Popular', value: 'popular' },
            { name: 'Most Connections', value: 'connections' },
            { name: 'Recently Added', value: 'recent' },
          )
          .setRequired(false),
      ),
    )
    .addSubcommand((subcommand) => subcommand
      .setName('join')
      .setDescription('🎟️ Join a hub.')
      .addChannelOption(channelOption =>
        channelOption
          .setName('channel')
          .addChannelTypes(ChannelType.GuildText)
          .setDescription('The channel that will be used to connect to the hub')
          .setRequired(true),
      )
      .addStringOption(stringOption =>
        stringOption
          .setName('name')
          .setDescription('The name of the hub (public only)')
          .setRequired(false),
      )
      .addStringOption(stringOption =>
        stringOption
          .setName('invite')
          .setDescription('The invite to the (private) hub')
          .setRequired(false),
      ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('🚪 Leave a hub.')
        .addStringOption(stringOption =>
          stringOption
            .setName('hub')
            .setDescription('The name of the hub')
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('✨ Create a hub.')
        .addStringOption((stringOption) =>
          stringOption
            .setName('name')
            .setDescription('The hub name')
            .setRequired(true),
        )
        .addAttachmentOption((attachment) =>
          attachment
            .setName('icon')
            .setDescription('Set an icon for this hub')
            .setRequired(true),
        )
        .addAttachmentOption((attachment) =>
          attachment
            .setName('banner')
            .setDescription('Set a banner for this hub')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('🗑️ Delete a hub.')
        .addStringOption((stringOption) =>
          stringOption
            .setName('hub')
            .setDescription('The hub name')
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('joined')
        .setDescription('👀 View all hubs this server is a part of!'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('manage')
        .setDescription('📝 Manage hubs that you own')
        .addStringOption((stringOption) =>
          stringOption
            .setName('name')
            .setDescription('The hub name')
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommandGroup((subcommandGroup) =>
      subcommandGroup
        .setName('invite')
        .setDescription('💼 Manage invites to hubs you own')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('create')
            .setDescription('🔗 Create a new invite code to your (private) hub')
            .addStringOption(stringOpt =>
              stringOpt
                .setName('hub')
                .setDescription('The name of the hub you wish to create this invite for')
                .setRequired(true),
            )
            .addNumberOption(numberOpt =>
              numberOpt
                .setName('expiry')
                .setDescription('The expiry of the invite link in hours. Eg. 10 (10 hours from now)')
                .setMinValue(1)
                .setMaxValue(48)
                .setRequired(false),
            ),
        )
        .addSubcommand((stringOption) =>
          stringOption
            .setName('revoke')
            .setDescription('🚫 Revoke an invite code to your hub')
            .addStringOption(stringOpt =>
              stringOpt
                .setName('code')
                .setDescription('The invite code')
                .setRequired(true),
            ),
        ),
    )
    .addSubcommandGroup((subcommandGroup) =>
      subcommandGroup
        .setName('moderator')
        .setDescription('Manage hub moderators')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setDescription('Add a new hub moderator')
            .addStringOption(stringOpt =>
              stringOpt
                .setName('hub')
                .setDescription('The name of the hub you wish to add moderators to')
                .setRequired(true),
            )
            .addUserOption(stringOpt =>
              stringOpt
                .setName('user')
                .setDescription('User who will become hub moderator')
                .setRequired(true),
            )
            .addStringOption(stringOpt =>
              stringOpt
                .setName('role')
                .setDescription('Determines what hub permissions they have')
                .addChoices(
                  { name: 'Network Moderator', value: 'network_mod' },
                  { name: 'Hub Manager', value: 'manager' },
                )
                .setRequired(false),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove')
            .setDescription('Remove a user from moderator position in your hub')
            .addStringOption(stringOpt =>
              stringOpt
                .setName('hub')
                .setDescription('The name of the hub you wish to add moderators to')
                .setRequired(true),
            )
            .addUserOption(userOpt =>
              userOpt
                .setName('user')
                .setDescription('The user who should be removed')
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('update')
            .setDescription('Update the role of a hub moderator')
            .addStringOption(stringOpt =>
              stringOpt
                .setName('hub')
                .setDescription('The name of the hub you wish to add moderators to')
                .setRequired(true),
            )
            .addUserOption(userOpt =>
              userOpt
                .setName('user')
                .setDescription('The moderator you wish the change')
                .setRequired(true),
            )
            .addStringOption(stringOpt =>
              stringOpt
                .setName('role')
                .setDescription('The moderator role to update')
                .setRequired(true)
                .addChoices(
                  { name: 'Network Moderator', value: 'network_mod' },
                  { name: 'Hub Manager', value: 'manager' },
                ),
            ),
        ),
    ).addSubcommand((subcommand) =>
      subcommand
        .setName('networks')
        .setDescription('List all networks that have joined the hub')
        .addStringOption(stringOpt =>
          stringOpt
            .setName('hub')
            .setDescription('The name of the hub')
            .setAutocomplete(true)
            .setRequired(true),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const extra = subcommand === 'leave'
      ? interaction.options.getString('hub', true)
      : subcommand === 'delete'
        ? interaction.options.getString('hub', true)
        : null;

    require(`../../Scripts/hub/${subcommandGroup || subcommand}`).execute(interaction, extra);
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const focusedValue = interaction.options.getFocused();
    let hubChoices;

    if (subcommand === 'browse') {
      hubChoices = await getDb().hubs.findMany({
        where: {
          name: { mode: 'insensitive', contains: focusedValue },
          private: false,
        },
        take: 25,
      });

    }
    else if (subcommand === 'manage' || subcommand === 'networks') {
      hubChoices = await getDb().hubs.findMany({
        where: {
          name: {
            mode: 'insensitive',
            contains: focusedValue,
          },
          OR: [
            { ownerId: interaction.user.id },
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
        take: 25,
      });
    }

    else if (subcommand === 'leave') {
      const networks = await getDb().connectedList.findMany({
        where: { serverId: interaction.guild?.id },
        select: { channelId: true, hub: true },
        take: 25,
      });

      const filteredNets = networks
        .filter((network) => network.hub?.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(async (network) => {
          const channel = await interaction.guild?.channels.fetch(network.channelId).catch(() => null);
          return { name: `${network.hub?.name} | #${channel?.name || network.channelId}`, value: network.channelId };
        });

      return await interaction.respond(await Promise.all(filteredNets));
    }

    else if (subcommand === 'delete') {
      hubChoices = await getDb().hubs.findMany({
        where: {
          ownerId: interaction.user.id,
          name: {
            mode: 'insensitive',
            contains: focusedValue,
          },
        },
        take: 25,
      });
    }

    const filtered = hubChoices?.map((hub) => ({ name: hub.name, value: hub.name }));
    filtered ? await interaction.respond(filtered) : null;
  },
};
