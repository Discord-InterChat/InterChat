import BaseCommand from '#main/core/BaseCommand.js';
import type HubManager from '#main/managers/HubManager.js';
import { HubService } from '#main/services/HubService.js';
import {
  type OriginalMessage,
  findOriginalMessage,
  getBroadcasts,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';

import {
  ApplicationCommandType,
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import { t } from '#utils/Locale.js';
import { logMsgDelete } from '#utils/hub/logger/ModLogs.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import { deleteMessageFromHub, isDeleteInProgress } from '#utils/moderation/deleteMessage.js';

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIContextMenuApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Delete Message',
    contexts: [InteractionContextType.Guild],
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if ((await this.checkOrSetCooldown(interaction)) || !interaction.inCachedGuild()) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const originalMsg = await this.getOriginalMessage(interaction.targetId);
    const hub = await this.fetchHub(originalMsg?.hubId);

    const validation = await this.validateMessage(interaction, originalMsg, hub);
    if (!validation) return;

    await this.processMessageDeletion(interaction, originalMsg!, validation.hub);
  }

  private async getOriginalMessage(messageId: string) {
    const originalMsg =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));
    return originalMsg;
  }

  private async processMessageDeletion(
    interaction: MessageContextMenuCommandInteraction,
    originalMsg: OriginalMessage,
    hub: HubManager,
  ): Promise<void> {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    await interaction.editReply(
      `${this.getEmoji('tick_icon')} Your request has been queued. Messages will be deleted shortly...`,
    );

    const broadcasts = Object.values(await getBroadcasts(originalMsg.messageId, originalMsg.hubId));
    const { deletedCount } = await deleteMessageFromHub(hub.id, originalMsg.messageId, broadcasts);

    await interaction
      .editReply(
        t('network.deleteSuccess', locale, {
          emoji: this.getEmoji('tick_icon'),
          user: `<@${originalMsg.authorId}>`,
          deleted: `${deletedCount}`,
          total: `${broadcasts.length}`,
        }),
      )
      .catch(() => null);

    await this.logDeletion(interaction, hub, originalMsg);
  }

  private async fetchHub(hubId?: string): Promise<HubManager | null> {
    if (!hubId) return null;
    return await new HubService().fetchHub(hubId);
  }

  private async validateMessage(
    interaction: MessageContextMenuCommandInteraction,
    originalMsg: OriginalMessage | null,
    hub: HubManager | null,
  ) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!originalMsg || !hub) {
      await interaction.editReply(
        t('errors.unknownNetworkMessage', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      );
      return false;
    }

    if (await isDeleteInProgress(originalMsg.messageId)) {
      await this.replyEmbed(
        interaction,
        `${this.getEmoji('neutral')} This message is already deleted or is being deleted by another moderator.`,
        { flags: 'Ephemeral', edit: true },
      );
      return false;
    }

    if (
      interaction.user.id !== originalMsg.authorId &&
      !(await isStaffOrHubMod(interaction.user.id, hub))
    ) {
      await interaction.editReply(
        t('errors.notMessageAuthor', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      );
      return false;
    }

    return { hub };
  }

  private async logDeletion(
    interaction: MessageContextMenuCommandInteraction,
    hub: HubManager,
    originalMsg: OriginalMessage,
  ): Promise<void> {
    if (!(await isStaffOrHubMod(interaction.user.id, hub))) return;

    await logMsgDelete(interaction.client, originalMsg, await hub.fetchLogConfig(), {
      hubName: hub.data.name,
      modName: interaction.user.username,
    });
  }
}
