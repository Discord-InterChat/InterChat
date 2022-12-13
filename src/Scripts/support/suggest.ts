import { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, TextInputBuilder, ModalBuilder, TextInputStyle, ChannelType } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    const suggestionChannel = await interaction.client.channels.fetch(constants.channel.suggestions);

    if (suggestionChannel?.type !== ChannelType.GuildForum) return interaction.reply('An error occured when trying to send your suggestion! Please join the server to manually suggest in the suggestion channel or report a bug.');
    const suggestionTag = suggestionChannel.availableTags.find(tag => tag.name === 'Bot Related');


    // modal
    const modal = new ModalBuilder()
      .setTitle('Suggestion')
      .setCustomId('suggestion')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            new TextInputBuilder()
              .setCustomId('Title')
              .setLabel('Title')
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),

        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            new TextInputBuilder()
              .setCustomId('Description')
              .setLabel('What is your suggestion about?')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(950),
          ),
      );


    await interaction.showModal(modal);

    interaction.awaitModalSubmit({
      filter: (m) => m.user.id === interaction.user.id,
      time: 60000,
    }).then(async (modalInteraction) => {
      const attachment = interaction.options.getAttachment('screenshot');
      const title = modalInteraction.fields.getTextInputValue('Title');
      const description = modalInteraction.fields.getTextInputValue('Description');

      const suggestionEmbed = new EmbedBuilder()
        .setAuthor({ name: `Suggestion from ${modalInteraction.user.tag}`, iconURL: modalInteraction.user.displayAvatarURL() })
        .setDescription(description)
        .setImage(attachment?.url as string | null)
        .setColor(colors('chatbot'))
        .addFields({
          name: 'Status',
          value: '🧑‍💻 Pending',
        });


      try {
        await suggestionChannel?.threads.create({
          name: title,
          appliedTags: suggestionTag ? [suggestionTag.id] : undefined,
          message: {
            content: 'This suggestion was sent using `/support suggest`.',
            embeds: [suggestionEmbed],
          },
        });
      }
      catch (err) {
        logger.error('Error while creating suggestion post:', err);
        return modalInteraction.reply({ content: 'An error occured while making your suggestion! The developers have been alerted.', ephemeral: true });
      }
      modalInteraction.reply({ content: 'Suggestion sent! Join the support server to see it.', ephemeral: true });
    }).catch(() => {return;});

  },
};