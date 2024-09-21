import { emojis } from '#main/config/Constants.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { CustomID } from '#main/utils/CustomID.js';
import { t, type supportedLocaleCodes } from '#main/utils/Locale.js';
import {
  BlacklistServerHandler,
  BlacklistUserHandler,
} from '#main/utils/moderation/modActions/handlers/blacklistHandler.js';
import { DeleteMessageHandler } from '#main/utils/moderation/modActions/handlers/deleteMsgHandler.js';
import { UserBanHandler } from '#main/utils/moderation/modActions/handlers/userBanHandler.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import {
  fetchMessageFromDb,
  ModAction,
  ModActionsDbMsgT,
} from '#main/utils/moderation/modActions/utils.js';
import { isStaffOrHubMod } from '#main/utils/Utils.js';
import {
  ApplicationCommandType,
  ButtonInteraction,
  RepliableInteraction,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Moderation Actions',
    dm_permission: false,
  };

  private modActionHandlers: Record<string, ModAction>;

  constructor() {
    super();
    this.modActionHandlers = {
      deleteMsg: new DeleteMessageHandler(),
      banUser: new UserBanHandler(),
      blacklistUser: new BlacklistUserHandler(),
      blacklistServer: new BlacklistServerHandler(),
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

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg!);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  @RegisterInteractionHandler('modMessage')
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
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.messageNotSentOrExpired', locale }, { emoji: emojis.info }),
        { ephemeral: true, edit: true },
      );
      return false;
    }

    if (originalMsg.authorId === interaction.user.id) {
      await interaction.editReply(
        '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t moderate your own messages.',
      );
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
