import BaseCommand from '#main/core/BaseCommand.js';
import { buildModPanel } from '#main/interactions/ModPanel.js';
import { HubService } from '#main/services/HubService.js';
import db from '#main/utils/Db.js';
import {
  findOriginalMessage,
  getOriginalMessage,
  OriginalMessage,
} from '#main/utils/network/messageUtils.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import { t, type supportedLocaleCodes } from '#utils/Locale.js';
import {
  ApplicationCommandType,
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  type RepliableInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

export default class BlacklistCtxMenu extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Moderation Actions',
    contexts: [InteractionContextType.Guild],
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const { userManager } = interaction.client;
    const dbUser = await userManager.getUser(interaction.user.id);
    const locale = await userManager.getUserLocale(dbUser);

    const originalMsg =
      (await getOriginalMessage(interaction.targetId)) ??
      (await findOriginalMessage(interaction.targetId));

    if (
      !BlacklistCtxMenu.dbMsgExists(originalMsg) ||
      !(await this.validateMessage(interaction, originalMsg, locale))
    ) {
      return;
    }

    const { embed, buttons } = await buildModPanel(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: buttons });
  }

  private static dbMsgExists(originalMsg: OriginalMessage | null): originalMsg is OriginalMessage {
    return Boolean(originalMsg);
  }

  private async validateMessage(
    interaction: RepliableInteraction,
    originalMsg: OriginalMessage,
    locale: supportedLocaleCodes,
  ) {
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMsg.hubId);
    if (!hub || !isStaffOrHubMod(interaction.user.id, hub)) {
      await this.replyEmbed(interaction, t('errors.messageNotSentOrExpired', locale), {
        ephemeral: true,
        edit: true,
      });
      return false;
    }

    return true;
  }
}
