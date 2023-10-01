import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb, checkIfStaff } from '../../Utils/utils';
import { networkMessageDelete } from '../../Scripts/networkLogs/msgDelete';
import { captureException } from '@sentry/node';
import emojis from '../../Utils/JSON/emoji.json';


export default {
  description: 'Delete a message that was sent in the network.',
  data: new ContextMenuCommandBuilder()
    .setName('Delete Message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const emoji = emojis.normal;
    const messageInDb = await db?.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: interaction.targetId } } } },
      include: { hub: true },
    });

    if (!messageInDb) return await interaction.editReply('Unknown Message. If it has been sent in the past minute, please wait few more seconds and try again.');

    const interchatStaff = checkIfStaff(interaction.user.id);
    if (
      !interchatStaff &&
      !messageInDb.hub?.moderators.find((m) => m.userId === interaction.user.id) &&
       messageInDb.hub?.ownerId !== interaction.user.id &&
       interaction.user.id !== messageInDb.authorId
    ) return await interaction.editReply(`${emoji.no} You are not the author of this message.`);


    const results = messageInDb.channelAndMessageIds.map(async (element) => {
      // fetch each channel the message was sent to
      const channel = await interaction.client.channels.fetch(element.channelId).catch(() => null);
      if (!channel?.isTextBased()) return false;

      // fetch the message from the channel and the webhook from the message
      const message = await channel.messages.fetch(element.messageId).catch(() => null);
      const webhook = await message?.fetchWebhook()?.catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user?.id) return false;

      // finally, delete the message
      return await webhook?.deleteMessage(element.messageId, channel.isThread() ? channel.id : undefined)
        .then(() => true)
        .catch((e) => {
          captureException(e, { user: { username: interaction.user.username, extra: { action: 'networkMessageDelete ' } } });
          return false;
        });
    });

    const resultsArray = await Promise.all(results);
    const deleted = resultsArray.reduce((acc, cur) => acc + (cur ? 1 : 0), 0);
    await interaction.editReply(`${emoji.yes} Your message has been deleted from __**${deleted}/${resultsArray.length}**__ servers.`).catch(() => null);

    // log the deleted message for moderation purposes
    if (interaction.inCachedGuild()) networkMessageDelete(interaction.member, interaction.targetMessage);
  },
};
