import BaseCommand from '#main/core/BaseCommand.js';
import HubManager from '#main/managers/HubManager.js';
import { HubService } from '#main/services/HubService.js';
import {
  findOriginalMessage,
  getBroadcasts,
  getOriginalMessage,
  OriginalMessage,
} from '#main/utils/network/messageUtils.js';
import Constants, { emojis } from '#utils/Constants.js';
import { logMsgDelete } from '#utils/hub/logger/ModLogs.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import { t } from '#utils/Locale.js';
import { deleteMessageFromHub, isDeleteInProgress } from '#utils/moderation/deleteMessage.js';
import {
  ApplicationCommandType,
  InteractionContextType,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Delete Message',
    contexts: [InteractionContextType.Guild],
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if ((await this.checkOrSetCooldown(interaction)) || !interaction.inCachedGuild()) return;

    await interaction.deferReply({ ephemeral: true });

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
      `${emojis.yes} Your request has been queued. Messages will be deleted shortly...`,
    );

    const broadcasts = Object.values(await getBroadcasts(originalMsg.messageId, originalMsg.hubId));
    const { deletedCount } = await deleteMessageFromHub(hub.id, originalMsg.messageId, broadcasts);

    await interaction
      .editReply(
        t('network.deleteSuccess', locale, {
          emoji: emojis.yes,
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
      await interaction.editReply(t('errors.unknownNetworkMessage', locale, { emoji: emojis.no }));
      return false;
    }

    if (await isDeleteInProgress(originalMsg.messageId)) {
      await this.replyEmbed(
        interaction,
        `${emojis.neutral} This message is already deleted or is being deleted by another moderator.`,
        { ephemeral: true, edit: true },
      );
      return false;
    }

    if (
      interaction.user.id !== originalMsg.authorId &&
      !await isStaffOrHubMod(interaction.user.id, hub)
    ) {
      await interaction.editReply(t('errors.notMessageAuthor', locale, { emoji: emojis.no }));
      return false;
    }

    return { hub };
  }

  private async logDeletion(
    interaction: MessageContextMenuCommandInteraction,
    hub: HubManager,
    originalMsg: OriginalMessage,
  ): Promise<void> {
    if (!await isStaffOrHubMod(interaction.user.id, hub)) return;

    const { targetMessage } = interaction;
    const messageContent =
      targetMessage.cleanContent ?? targetMessage.embeds.at(0)?.description?.replaceAll('`', '\\`');

    if (!messageContent) return;

    const imageUrl =
      targetMessage.embeds.at(0)?.image?.url ??
      targetMessage.content.match(Constants.Regex.ImageURL)?.[0];

    await logMsgDelete(
      interaction.client,
      messageContent,
      hub.data.name,
      await hub.fetchLogConfig(),
      {
        userId: originalMsg.authorId,
        serverId: originalMsg.guildId,
        modName: interaction.user.username,
        imageUrl,
      },
    );
  }
}
