import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, TextChannel } from 'discord.js';
import { getDb, checkIfStaff } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { networkMessageDelete } from '../../Scripts/networkLogs/networkMsgDelete';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Delete Message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const target = interaction.targetMessage;
    const staffUser = await checkIfStaff(interaction.user);
    const messageInDb = await db?.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
    });
    const emojis = interaction.client.emoji.normal;

    if (!messageInDb || (messageInDb?.expired && staffUser === false)) {
      return interaction.reply({ content: 'This message has expired.', ephemeral: true });
    }

    // if the user tries to edit someone else' message and they arent staff
    if (!staffUser && interaction.user.id !== messageInDb.authorId) {
      return interaction.reply({ content: `${emojis.no} You are not the author of this message.`, ephemeral: true });
    }

    await interaction.reply({ content: `${emojis.yes} Deletion in progess! This may take a few seconds.`, ephemeral: true }).catch(() => null);

    messageInDb.channelAndMessageIds.forEach((element) => {
      if (!element) return;

      interaction.client.channels
        .fetch(element.channelId)
        .then((channel) => {
          (channel as TextChannel).messages
            .fetch(element.messageId)
            .then((message) => message.delete())
            .catch((e) => logger.error('Delete Message:', e));
        })
        .catch(logger.error);
    });

    // log the deleted message for moderation purposes
    interaction.inCachedGuild()
      ? networkMessageDelete(interaction.member, target)
      : null;
  },
};
