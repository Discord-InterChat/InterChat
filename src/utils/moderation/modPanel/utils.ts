import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  RepliableInteraction,
  Snowflake,
} from 'discord.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { getReplyMethod } from '#src/utils/Utils.js';
import type { OriginalMessage } from '#src/utils/network/messageUtils.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';

export interface ModAction {
  handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ): Promise<void>;
  handleModal?(
    interaction: ModalSubmitInteraction,
    originalMsg: OriginalMessage,
    locale: supportedLocaleCodes,
  ): Promise<void>;
}

export async function replyWithUnknownMessage(
  interaction: RepliableInteraction,
  locale: supportedLocaleCodes,
  edit = false,
) {
  const embed = new InfoEmbed().setDescription(
    t('errors.unknownNetworkMessage', locale, {
      emoji: getEmoji('x_icon', interaction.client),
    }),
  );

  const replyMethod = getReplyMethod(interaction);

  if (edit) {
    await interaction.editReply({ embeds: [embed] });
  }
  else {
    await interaction[replyMethod]({ embeds: [embed], flags: ['Ephemeral'] });
  }
}
