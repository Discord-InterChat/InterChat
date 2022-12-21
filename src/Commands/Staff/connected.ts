import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export default {
  staff: true,
  data: new SlashCommandBuilder()
    .setName('connected-list')
    .setDescription('Display the connected servers. (Staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    require('../../Scripts/connected/server').execute(interaction);
  },
};