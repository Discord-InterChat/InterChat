import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, WebhookClient, EmbedBuilder } from 'discord.js';
import { networkMsgUpdate } from '../../Scripts/networkLogs/msgUpdate';
import { checkIfStaff, getDb, getGuildName, topgg } from '../../Utils/functions/utils';
import wordFiler from '../../Utils/functions/wordFilter';
import { captureException } from '@sentry/node';

export default {
  description: 'Edit a message that was sent in the network.',
  data: new ContextMenuCommandBuilder()
    .setName('Edit Message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const target = interaction.targetMessage;

    if (!await topgg.hasVoted(interaction.user.id) && !checkIfStaff(interaction.user.id)) {
      await interaction.reply({
        content: `${interaction.client.emotes.normal.no} You must [vote](<https://top.gg/bot/${interaction.client.user.id}/vote>) to use this command.`,
        ephemeral: true,
      });
      return;
    }

    const db = getDb();
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
    });

    if (!messageInDb) {
      await interaction.reply({
        content: 'This message has expired. If not, please wait a few seconds and try again.',
        ephemeral: true,
      });
      return;
    }

    else if (interaction.user.id != messageInDb?.authorId) {
      await interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.id)
      .setTitle('Edit Message')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setRequired(true)
            .setCustomId('newMessage')
            .setStyle(TextInputStyle.Paragraph)
            .setLabel('Please enter your new message.')
            .setValue(`${target.content || target.embeds[0]?.description}`)
            .setMaxLength(950),
        ),
      );

    await interaction.showModal(modal);

    interaction.awaitModalSubmit({ filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 30_000 })
      .then(async i => {
        // get the input from user
        const newMessage = i.fields.getTextInputValue('newMessage');
        const censoredNewMessage = wordFiler.censor(newMessage);

        // get the reply from the target message
        const newEmbed = !target.content
          ? EmbedBuilder.from(target.embeds[0])
          : new EmbedBuilder()
            .setAuthor({ name: target.author.username, iconURL: target.author.displayAvatarURL() })
            .setDescription(target.content)
            .setColor(target.member?.displayHexColor ?? 'Random')
            .addFields(target.embeds[0] ? [{ name: 'Reply-to', value: `${target.embeds[0].description}` }] : [])
            .setFooter({ text: `Server: ${getGuildName(interaction.client, messageInDb.serverId)}` });

        const censoredEmbed = EmbedBuilder.from(newEmbed).setDescription(censoredNewMessage);

        i.reply({
          content: `${interaction.client.emotes.normal.yes} Message Edited. Please give a few seconds for it to reflect in all connections.`,
          ephemeral: true,
        });
        const channelSettingsArr = await db.connectedList.findMany({
          where: { channelId: { in: messageInDb.channelAndMessageIds.map(c => c.channelId) } },
        });

        messageInDb.channelAndMessageIds.forEach(async obj => {
          const channelSettings = channelSettingsArr.find(c => c.channelId === obj.channelId);

          if (channelSettings) {
            const webhook = new WebhookClient({ id: channelSettings.webhook.id, token: channelSettings.webhook.token });
            const compact = channelSettings?.profFilter ? newMessage : censoredNewMessage;
            const webhookEmbed = channelSettings?.profFilter ? censoredEmbed : newEmbed;

            channelSettings?.compact
              ? webhook.editMessage(obj.messageId, compact)
              : webhook.editMessage(obj.messageId, { files: [], embeds: [webhookEmbed] });
          }
        });


        interaction.inCachedGuild()
          ? networkMsgUpdate(interaction.member, target, {
            id: target.id, content: newMessage,
          })
          : null;

      }).catch((reason) => {
        !reason.message.includes('reason: time')
          ? captureException(reason, { user: { id: interaction.user.id, username: interaction.user.username }, extra: { command: 'Edit Message' } })
          : null;
      });
  },
};
