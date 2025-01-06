import {
  ApplicationCommandType,
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  type RepliableInteraction,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { buildModPanel } from '#main/interactions/ModPanel.js';
import { HubService } from '#main/services/HubService.js';
import db from '#main/utils/Db.js';
import {
  type OriginalMessage,
  findOriginalMessage,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';
import { t } from '#utils/Locale.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import { fetchUserData, fetchUserLocale } from '#main/utils/Utils.js';

export default class BlacklistCtxMenu extends BaseCommand {
  readonly data: RESTPostAPIContextMenuApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Moderation Actions',
    contexts: [InteractionContextType.Guild],
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ flags: ['Ephemeral'] });


    const dbUser = await fetchUserData(interaction.user.id);
    const locale = dbUser ? await fetchUserLocale(dbUser) : 'en';

    const originalMsg =
      (await getOriginalMessage(interaction.targetId)) ??
      (await findOriginalMessage(interaction.targetId));

    if (!originalMsg || !(await this.validateMessage(interaction, originalMsg))) {
      await interaction.editReply({
        content: t('errors.messageNotSentOrExpired', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      });
      return;
    }

    const { embed, buttons } = await buildModPanel(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: buttons });
  }

  private async validateMessage(interaction: RepliableInteraction, originalMsg: OriginalMessage) {
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMsg.hubId);

    if (!hub || !(await isStaffOrHubMod(interaction.user.id, hub))) {
      return false;
    }

    return true;
  }
}
