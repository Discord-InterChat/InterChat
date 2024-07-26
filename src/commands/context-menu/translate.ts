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
import BaseCommand from '../../core/BaseCommand.js';
import { getUserLocale, userVotedToday } from '../../utils/Utils.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { CustomID } from '../../utils/CustomID.js';
import { t } from '../../utils/Locale.js';
// @ts-expect-error no types provided for this package
import { translate, isSupported } from 'google-translate-api-x';
import { emojis } from '../../utils/Constants.js';

export default class Translate extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Translate',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const locale = await getUserLocale(interaction.user.id);

    if (!(await userVotedToday(interaction.user.id))) {
      await interaction.editReply(t({ phrase: 'errors.mustVote', locale }, { emoji: emojis.no }));
      return;
    }

    const target = interaction.targetMessage;

    const originalMsg = (
      await db.broadcastedMessages.findFirst({
        where: { messageId: target.id },
        include: { originalMsg: true },
      })
    )?.originalMsg;

    if (!originalMsg) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const messageContent = target.content || target.embeds[0]?.description;
    if (!messageContent) {
      await interaction.editReply('This message is not translatable.');
      return;
    }

    const translatedMessage = await translate(messageContent, { to: locale });
    const embed = new EmbedBuilder()
      .setDescription('### Translation Results')
      .setColor('Green')
      .addFields(
        {
          name: `Original Message (${translatedMessage.from.language.iso})`,
          value: messageContent,
          inline: true,
        },
        {
          name: 'Translated Message',
          value: translatedMessage.text,
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
  override async handleComponents(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(new CustomID('translate_modal').toString())
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
    if (!messageContent) {
      await interaction.reply('This message is not translatable.');
      return;
    }

    const locale = await getUserLocale(interaction.user.id);
    const to = interaction.fields.getTextInputValue('to');
    const from = interaction.fields.getTextInputValue('from');
    if (!isSupported(from) || !isSupported(to)) {
      await interaction.reply({
        content: t({ phrase: 'errors.invalidLangCode', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const newTranslation = await translate(messageContent, { to, from });
    const newEmbed = EmbedBuilder.from(originalMessage.embeds[0]).spliceFields(1, 1, {
      name: `Translated Message (${to})`,
      value: newTranslation.text,
      inline: true,
    });

    await interaction.reply({ embeds: [newEmbed], ephemeral: true });
  }
}
