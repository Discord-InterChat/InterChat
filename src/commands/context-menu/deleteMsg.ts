import {
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../core/BaseCommand.js';
import { checkIfStaff } from '../../utils/Utils.js';
import { emojis } from '../../utils/Constants.js';
import { t } from '../../utils/Locale.js';
import db from '../../utils/Db.js';

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Delete Message',
    dm_permission: false,
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const isOnCooldown = await this.checkAndSetCooldown(interaction);
    if (isOnCooldown) return;

    await interaction.deferReply({ ephemeral: true });

    const messageInDb = await db?.broadcastedMessages.findFirst({
      where: { messageId: interaction.targetId },
      include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
    });

    if (!messageInDb) {
      return await interaction.editReply(
        t(
          {
            phrase: 'errors.unknownNetworkMessage',
            locale: interaction.user.locale,
          },
          { emoji: emojis.no },
        ),
      );
    }

    const interchatStaff = checkIfStaff(interaction.user.id);
    if (
      !interchatStaff &&
      !messageInDb.originalMsg.hub?.moderators.find((m) => m.userId === interaction.user.id) &&
      messageInDb.originalMsg.hub?.ownerId !== interaction.user.id &&
      interaction.user.id !== messageInDb.originalMsg.authorId
    ) {
      return await interaction.editReply(
        t(
          {
            phrase: 'errors.notMessageAuthor',
            locale: interaction.user.locale,
          },
          { emoji: emojis.no },
        ),
      );
    }

    const results = messageInDb.originalMsg.broadcastMsgs.map(async (element) => {
      const connection = interaction.client.connectionCache.find(
        (c) => c.channelId === element.channelId,
      );
      if (!connection) return false;

      const webhookURL = connection.webhookURL.split('/');
      const webhook = await interaction.client
        .fetchWebhook(webhookURL[webhookURL.length - 2])
        ?.catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user?.id) return false;

      // finally, delete the message
      return await webhook
        ?.deleteMessage(element.messageId, connection.parentId ? connection.channelId : undefined)
        .then(() => true)
        .catch(() => false);
    });

    const resultsArray = await Promise.all(results);
    const deleted = resultsArray.reduce((acc, cur) => acc + (cur ? 1 : 0), 0);
    await interaction
      .editReply(
        t(
          {
            phrase: 'network.deleteSuccess',
            locale: interaction.user.locale,
          },
          {
            emoji: emojis.yes,
            user: `<@${messageInDb.originalMsg.authorId}>`,
            deleted: deleted.toString(),
            total: resultsArray.length.toString(),
          },
        ),
      )
      .catch(() => null);

    // log the deleted message for moderation purposes TODO
    // if (interaction.inCachedGuild()) networkMessageDelete(interaction.member, interaction.targetMessage);
  }
}
