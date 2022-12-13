import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
  staff: true,
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Actions for the support team to interact with suggestions.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('update')
        .setDescription('Set a status for suggestions. Eg. Pending, Approved, Implemented')
        .addStringOption(messageOption =>
          messageOption
            .setName('postid')
            .setDescription('The ID of the suggestion message.')
            .setRequired(true),
        )
        .addStringOption(statusOption =>
          statusOption
            .setName('status')
            .setDescription('The status to set to the suggestion')
            .setRequired(true)
            .addChoices(
              { name: 'Approved', value: '✅ Approved' },
              { name: 'Pending', value: '🧑‍💻 Pending' },
              { name: 'Implemented', value: '✅ Implemented' },
              { name: 'Rejected', value: '❌ Rejected' },
              { name: 'Closed', value: '🚫 Closed' },
            ),
        )
        .addStringOption(reasonOption =>
          reasonOption
            .setName('reason')
            .setDescription('An optional message to explain to the suggestion author about the change')
            .setRequired(false),
        ),
    ).addSubcommand(subcommand =>
      subcommand
        .setName('takedown')
        .setDescription('Delete the suggestion message. This is irreversible!')
        .addStringOption(messageOption =>
          messageOption
            .setName('postid')
            .setDescription('The ID of the suggestion message.')
            .setRequired(true),
        )
        .addBooleanOption(booloption =>
          booloption
            .setName('keepmessage')
            .setDescription('If set to true the suggestion message will be edited to leave a note saying it was taken down.')
            .setRequired(true)),
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const script = await import(`../../Scripts/suggestions/${subcommand}`);
    script.default.execute(interaction);
  },
};