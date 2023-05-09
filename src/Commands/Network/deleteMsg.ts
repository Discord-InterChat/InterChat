import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb, checkIfStaff } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { networkMessageDelete } from '../../Scripts/networkLogs/msgDelete';

export default {
  description: 'Delete a message that was sent in the network.',
  data: new ContextMenuCommandBuilder()
    .setName('Delete Message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const target = interaction.targetMessage;
    const staffUser = checkIfStaff(interaction.user.id);
    const messageInDb = await db?.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
    });
    const emoji = interaction.client.emotes.normal;

    if (!messageInDb) return interaction.reply({ content: 'This message has expired.', ephemeral: true });

    // if the user tries to delete someone else's message and they arent staff
    if (!staffUser && interaction.user.id !== messageInDb.authorId) {
      return interaction.reply({ content: `${emoji.no} You are not the author of this message.`, ephemeral: true });
    }

    await interaction.reply({ content: `${emoji.yes} Deletion in progess! This may take a few seconds.`, ephemeral: true }).catch(() => null);

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
      ? networkMessageDelete(interaction.member, target)
      : null;
  },
};
