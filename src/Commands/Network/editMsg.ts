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

    const editInteraction = await interaction.awaitModalSubmit({
      filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id,
      time: 30_000,
    }).catch((reason) => {
      if (!reason.message.includes('reason: time')) {
        captureException(reason, {
          user: { id: interaction.user.id, username: interaction.user.username },
          extra: { command: 'Edit Message' },
        });
      }

      return null;
    });

    if (!editInteraction) return;

    // get the input from user
    const newMessage = editInteraction.fields.getTextInputValue('newMessage');
    const censoredNewMessage = wordFiler.censor(newMessage);

    // if the message being edited is in compact mode
    // then we create a new embed with the new message and old reply
    // else we just use the old embed and replace the description
    const newEmbed = target.content
      ? new EmbedBuilder()
        .setAuthor({ name: target.author.username, iconURL: target.author.displayAvatarURL() })
        .setDescription(newMessage)
        .setColor(target.member?.displayHexColor ?? 'Random')
        .addFields(target.embeds[0] ? [{ name: 'Reply-to', value: `${target.embeds[0].description}` }] : [])
        .setFooter({ text: `Server: ${getGuildName(interaction.client, messageInDb.serverId)}` })
      : EmbedBuilder.from(target.embeds[0]).setDescription(newMessage);

    const censoredEmbed = EmbedBuilder.from(newEmbed).setDescription(censoredNewMessage);

    // find all the messages through the network
    const channelSettingsArr = await db.connectedList.findMany({
      where: { channelId: { in: messageInDb.channelAndMessageIds.map(c => c.channelId) } },
    });

    // edit the messages
    messageInDb.channelAndMessageIds.forEach(async obj => {
      const channelSettings = channelSettingsArr.find(c => c.channelId === obj.channelId);

      if (channelSettings) {
        const webhook = new WebhookClient({ url: channelSettings.webhookURL });

        channelSettings?.compact ?
          webhook.editMessage(obj.messageId, {
            content: channelSettings?.profFilter ? newMessage : censoredNewMessage,
            threadId: channelSettings.parentId ? channelSettings.channelId : undefined,
          })
          : webhook.editMessage(obj.messageId, {
            files: [],
            embeds: [channelSettings?.profFilter ? censoredEmbed : newEmbed],
            threadId: channelSettings.parentId ? channelSettings.channelId : undefined,
          });
      }
    });

    editInteraction.reply({
      content: `${interaction.client.emotes.normal.yes} Message Edited. Please give a few seconds for it to reflect in all connections.`,
      ephemeral: true,
    });

    interaction.inCachedGuild()
      ? networkMsgUpdate(interaction.member, target, newMessage)
      : null;
  },
};
