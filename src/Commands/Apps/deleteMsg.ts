import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb, checkIfStaff } from '../../Utils/utils';
import logger from '../../Utils/logger';
import { networkMessageDelete } from '../../Scripts/networkLogs/msgDelete';
import emojis from '../../Utils/JSON/emoji.json';


export default {
  description: 'Delete a message that was sent in the network.',
  data: new ContextMenuCommandBuilder()
    .setName('Delete Message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const emoji = emojis.normal;
    const messageInDb = await db?.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: interaction.targetId } } } },
      include: { hub: true },
    });

    if (!messageInDb) {
      return interaction.reply({
        content: 'Unknown Message. If it has been sent in the past minute, please wait few more seconds and try again.',
        ephemeral: true,
      });
    }

    const interchatStaff = checkIfStaff(interaction.user.id);
    if (
      !interchatStaff &&
      !messageInDb.hub?.moderators.find((m) => m.userId === interaction.user.id) &&
       messageInDb.hub?.ownerId !== interaction.user.id &&
       interaction.user.id !== messageInDb.authorId
    ) {
      return interaction.reply({
        content: `${emoji.no} You are not the author of this message.`,
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `${emoji.yes} Deletion in progess! This may take a few seconds.`,
      ephemeral: true,
    }).catch(() => null);

    messageInDb.channelAndMessageIds.forEach((element) => {
      if (!element) return;

      interaction.client.channels
        .fetch(element.channelId)
        .then((channel) => {
          if (channel?.isTextBased()) {
            channel.messages.delete(element.messageId)
              .catch((e) => logger.error('Delete Message:', e));
          }
        })
        .catch(logger.error);
    });

    // log the deleted message for moderation purposes
    interaction.inCachedGuild()
      ? networkMessageDelete(interaction.member, interaction.targetMessage)
      : null;
  },
};
