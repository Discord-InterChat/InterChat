import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getDb, topgg } from '../../Utils/utils';
import { translateText } from '../../Utils/translate';
import { captureException } from '@sentry/node';
import { supportedLanguages } from '@translate-tools/core/translators/GoogleTranslator';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  description: 'Translate a message that was sent in a network channel. (Vote only)',
  data: new ContextMenuCommandBuilder()
    .setName('Translate')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const hasVoted = await topgg.hasVoted(interaction.user.id);
    if (!hasVoted) return await interaction.editReply('Please [vote](https://top.gg/bot/798748015435055134/vote) for Interchat to use this command, your support is very much appreciated!');

    const target = interaction.targetMessage;

    const db = getDb();
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target.id } } },
    });

    if (!messageInDb) return interaction.editReply('This message has expired. If not, please wait a few seconds and try again.');

    const messageContent = target.content || target.embeds[0]?.description;
    if (!messageContent) return interaction.editReply('This message is not translatable.');

    const translatedMessage = await translateText(messageContent, 'en', 'auto');
    const embed = new EmbedBuilder()
      .setDescription('### Translation Results')
      .setColor('Green')
      .addFields({
        name: 'Original Message',
        value: messageContent,
        inline: true,
      },
      {
        name: 'Translated Message',
        value: translatedMessage,
        inline: true,
      })
      .setFooter({ text: 'Translations provided may not be accurate.' });


    const init = await interaction.editReply({
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('lang')
            .setLabel('Specify Language')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌐'),
        ),
      ],
      embeds: [embed],
    });

    const collector = init.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.customId !== 'lang') return;

      const modal = new ModalBuilder()
        .setCustomId(i.id)
        .setTitle('Specify Language')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('from')
              .setLabel('From Language')
              .setPlaceholder('Input Language Code (e.g. en, fr, de)')
              .setStyle(TextInputStyle.Short)
              .setMinLength(2)
              .setMaxLength(2),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('to')
              .setLabel('To Language')
              .setPlaceholder('Input Language Code (e.g. en, fr, de)')
              .setStyle(TextInputStyle.Short)
              .setMinLength(2)
              .setMaxLength(2),
          ),
        );

      await i.showModal(modal);

      const modalInter = await i.awaitModalSubmit({ filter: (e) => e.customId === i.id, time: 60_000 })
        .catch((e) => {
          !e.message.includes('reason: time') ? captureException(e) : null;
          return null;
        });

      if (!modalInter) return;
      const to = modalInter.fields.getTextInputValue('to');
      const from = modalInter.fields.getTextInputValue('from');
      if (!supportedLanguages.includes(from) || !supportedLanguages.includes(to)) {
        await modalInter.reply({
          content: `${emojis.normal.no} Invalid language code. Please use one from the [here](https://cloud.google.com/translate/docs/languages).`,
          ephemeral: true,
        });
        return;
      }

      await modalInter.deferUpdate();

      const newTranslation = await translateText(messageContent, to, from);
      const newEmbed = EmbedBuilder.from(embed).spliceFields(1, 1, {
        name: 'Translated Message',
        value: newTranslation,
        inline: true,
      });

      await i.editReply({ embeds: [newEmbed] });
    });
  },
};