import { emojis } from '#main/config/Constants.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { CustomID } from '#main/utils/CustomID.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { t, type supportedLocaleCodes } from '#main/utils/Locale.js';
import {
  BlacklistServerHandler,
  BlacklistUserHandler,
} from '#main/utils/moderation/modActions/handlers/blacklistHandler.js';
import DeleteMessageHandler from '#main/utils/moderation/modActions/handlers/deleteMsgHandler.js';
import RemoveReactionsHandler from '#main/utils/moderation/modActions/handlers/RemoveReactionsHandler.js';
import UserBanHandler from '#main/utils/moderation/modActions/handlers/userBanHandler.js';
import ViewInfractionsHandler from '#main/utils/moderation/modActions/handlers/viewInfractions.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import {
  fetchMessageFromDb,
  ModAction,
  ModActionsDbMsgT,
} from '#main/utils/moderation/modActions/utils.js';
import { Hub } from '@prisma/client';
import {
  ApplicationCommandType,
  type ButtonInteraction,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

type ValidDbMsg = ModActionsDbMsgT & { hubId: string; hub: Hub };

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Moderation Actions',
    dm_permission: false,
  };

  private readonly modActionHandlers: Record<string, ModAction>;

  constructor() {
    super();
    this.modActionHandlers = {
      deleteMsg: new DeleteMessageHandler(),
      banUser: new UserBanHandler(),
      blacklistUser: new BlacklistUserHandler(),
      blacklistServer: new BlacklistServerHandler(),
      removeAllReactions: new RemoveReactionsHandler(),
      viewInfractions: new ViewInfractionsHandler(),
    };
  }

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const { userManager } = interaction.client;
    const dbUser = await userManager.getUser(interaction.user.id);
    const locale = await userManager.getUserLocale(dbUser);

    const originalMsg = await fetchMessageFromDb(interaction.targetId, {
      hub: true,
      broadcastMsgs: true,
    });

    if (!(await this.validateMessage(interaction, originalMsg, locale))) return;

    const { embed, buttons } = await modActionsPanel.buildMessage(
      interaction,
      originalMsg as ValidDbMsg,
    );

    await interaction.editReply({ embeds: [embed], components: buttons });
  }

  @RegisterInteractionHandler('modActions')
  async handleButtons(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, originalMsgId] = customId.args;
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!(await this.validateUser(interaction, userId, locale))) return;

    const handler = this.modActionHandlers[customId.suffix];
    if (handler) {
      await handler.handle(interaction, originalMsgId, locale);
    }
  }

  @RegisterInteractionHandler('blacklist_modal')
  async handleBlacklistModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [originalMsgId] = customId.args;
    const originalMsg = await fetchMessageFromDb(originalMsgId, { hub: true });
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!(await this.validateMessage(interaction, originalMsg, locale))) return;

    const handlerId = customId.suffix === 'user' ? 'blacklistUser' : 'blacklistServer';
    const handler = this.modActionHandlers[handlerId];
    if (handler?.handleModal) {
      await handler.handleModal(interaction, originalMsg!, locale);
    }
  }

  private async validateMessage(
    interaction: RepliableInteraction,
    originalMsg: ModActionsDbMsgT | null,
    locale: supportedLocaleCodes,
  ) {
    if (!originalMsg?.hub || !isStaffOrHubMod(interaction.user.id, originalMsg.hub)) {
      await this.replyEmbed(interaction, t({ phrase: 'errors.messageNotSentOrExpired', locale }), {
        ephemeral: true,
        edit: true,
      });
      return false;
    }

    return true;
  }

  private async validateUser(
    interaction: RepliableInteraction,
    userId: string,
    locale: supportedLocaleCodes,
  ) {
    if (interaction.user.id !== userId) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.notYourAction', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return false;
    }

    return true;
  }
}
