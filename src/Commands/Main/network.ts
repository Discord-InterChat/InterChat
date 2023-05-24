import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import displaySettings from '../../Scripts/network/displaySettings';

export default {
  data: new SlashCommandBuilder()
    .setName('network')
    .setDescription('Manage network connections for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((subcommand) => subcommand
      .setName('manage')
      .setDescription('Manage a network connection for this server.')
      .addStringOption((stringOption) =>
        stringOption
          .setName('network')
          .setDescription('Select the network you wish to edit.')
          .setRequired(true)
          .setAutocomplete(true),
      ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const database = getDb();
    const serverInBlacklist = await database.blacklistedServers.findFirst({
      where: { serverId: interaction.guild?.id },
    });
    const userInBlacklist = await database.blacklistedUsers.findFirst({
      where: { userId: interaction.user.id },
    });


    if (serverInBlacklist) {
      await interaction.reply('This server is blacklisted from using the Chat Network.');
      return;
    }
    else if (userInBlacklist) {
      await interaction.reply('You have been blacklisted from using the Chat Network.');
      return;
    }

    displaySettings.execute(interaction, interaction.options.getString('network', true));
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();

    const networks = await getDb().connectedList.findMany({
      where: { serverId: interaction.guild?.id },
      select: { channelId: true, hub: true },
      take: 25,
    });

    const filtered = networks
      .filter((network) => network.hub?.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .map(async (network) => {
        const channel = await interaction.guild?.channels.fetch(network.channelId).catch(() => null);
        return { name: `${network.hub?.name} | #${channel?.name || network.channelId}`, value: network.channelId };
      });


    interaction.respond(await Promise.all(filtered));
  },
};
