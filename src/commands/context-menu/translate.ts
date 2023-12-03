import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import db from '../../utils/Db.js';
import BaseCommand from '../BaseCommand.js';
import { hasVoted } from '../../utils/Utils.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { CustomID } from '../../utils/CustomID.js';
import { supportedLanguages } from '@translate-tools/core/translators/GoogleTranslator/index.js';
import translator from '../../utils/Translator.cjs';
import { __ } from '../../utils/Utils.js';

export default class Translate extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Translate',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasVoted(interaction.user.id))) {
      return await interaction.editReply(
        __({ phrase: 'errors.mustVote', locale: interaction.user.locale }),
      );
    }

    const target = interaction.targetMessage;

    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target.id } } },
    });

    if (!messageInDb) {
      return interaction.editReply(
        __({ phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale }),
      );
    }

    const messageContent = target.content || target.embeds[0]?.description;
    if (!messageContent) return interaction.editReply('This message is not translatable.');

    const translatedMessage = await translator.translateText(messageContent, 'en', 'auto');
    const embed = new EmbedBuilder()
      .setDescription('### Translation Results')
      .setColor('Green')
      .addFields(
        {
          name: 'Original Message',
          value: messageContent,
          inline: true,
        },
        {
          name: 'Translated Message',
          value: translatedMessage,
          inline: true,
        },
      )
      .setFooter({ text: 'Translations provided may not be accurate.' });

    await interaction.editReply({
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(new CustomID().setIdentifier('translate', 'lang').toString())
            .setLabel('Specify Language')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌐'),
        ),
      ],
      embeds: [embed],
    });
  }

  @RegisterInteractionHandler('translate')
  async handleComponents(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('translate_modal')
      .setTitle('Specify Language')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('from')
            .setLabel('From Language')
            .setPlaceholder('Input Language Code (e.g. en, fr, de)')
            .setStyle(TextInputStyle.Short)
            .setMinLength(2),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('to')
            .setLabel('To Language')
            .setPlaceholder('Input Language Code (e.g. en, fr, de)')
            .setStyle(TextInputStyle.Short)
            .setMinLength(2),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('translate_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const originalMessage = interaction.message;
    if (!originalMessage) return;

    // get original content the translate embed
    const messageContent = originalMessage.embeds[0]?.fields[0].value;
    if (!messageContent) return await interaction.reply('This message is not translatable.');

    const to = interaction.fields.getTextInputValue('to');
    const from = interaction.fields.getTextInputValue('from');
    if (!supportedLanguages.includes(from) || !supportedLanguages.includes(to)) {
      await interaction.reply({
        content: __({ phrase: 'errors.invalidLangCode', locale: interaction.user.locale }),
        ephemeral: true,
      });
      return;
    }

    const newTranslation = await translator.translateText(messageContent, to, from);
    const newEmbed = EmbedBuilder.from(originalMessage.embeds[0]).spliceFields(1, 1, {
      name: `Translated Message (${to})`,
      value: newTranslation,
      inline: true,
    });

    await interaction.reply({ embeds: [newEmbed], ephemeral: true });
  }
}
