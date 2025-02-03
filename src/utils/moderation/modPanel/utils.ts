/*
 * Copyright (C) 2025 InterChat
 *
 * InterChat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * InterChat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with InterChat.  If not, see <https://www.gnu.org/licenses/>.
 */

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
