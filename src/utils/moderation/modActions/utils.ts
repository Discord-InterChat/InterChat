import { emojis } from '#main/config/Constants.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import type { broadcastedMessages, Hub, originalMessages, Prisma } from '@prisma/client';
import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  RepliableInteraction,
  Snowflake,
} from 'discord.js';

export type ModActionsDbMsgT = originalMessages & {
  hub?: Hub | null;
  broadcastMsgs?: broadcastedMessages[];
};

export interface ModAction {
  handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ): Promise<void>;
  handleModal?(
    interaction: ModalSubmitInteraction,
    originalMsg: ModActionsDbMsgT,
    locale: supportedLocaleCodes,
  ): Promise<void>;
}

export const isValidDbMsgWithHubId = (
  obj: ModActionsDbMsgT,
): obj is ModActionsDbMsgT & { hubId: string } => obj.hubId !== null;

export const fetchMessageFromDb = async (
  messageId: string,
  include: Prisma.originalMessagesInclude = { hub: false, broadcastMsgs: false },
): Promise<ModActionsDbMsgT | null> => {
  let messageInDb = await db.originalMessages.findFirst({ where: { messageId }, include });

  if (!messageInDb) {
    const broadcastedMsg = await db.broadcastedMessages.findFirst({
      where: { messageId },
      include: { originalMsg: { include } },
    });

    messageInDb = broadcastedMsg?.originalMsg ?? null;
  }

  return messageInDb;
};

export async function replyWithUnknownMessage(
  interaction: RepliableInteraction,
  locale: supportedLocaleCodes,
  edit = false,
) {
  const embed = new InfoEmbed().setDescription(
    t('errors.unknownNetworkMessage', locale, { emoji: emojis.no }),
  );

  if (edit) await interaction.editReply({ embeds: [embed] });
  else await interaction.reply({ embeds: [embed] });
}
