import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, WebhookClient, EmbedBuilder, GuildTextBasedChannel } from 'discord.js';
import { networkMsgUpdate } from '../../Scripts/networkLogs/msgUpdate';
import { checkIfStaff, topgg } from '../../Utils/functions/utils';
import { prisma } from '../../Utils/db';
import wordFiler from '../../Utils/functions/wordFilter';
import logger from '../../Utils/logger';

export default {
  description: 'Edit a message that was sent in the network.',
  data: new ContextMenuCommandBuilder()
    .setName('Edit Message')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const target = interaction.targetMessage;
    const hasVoted = await topgg.hasVoted(interaction.user.id);
    const isStaff = await checkIfStaff(interaction.user);

    if (!hasVoted && !isStaff) {
      interaction.reply({
        content: `${interaction.client.emoji.normal.no} You must [vote](<https://top.gg/bot/769921109209907241/vote>) to use this command.`,
        ephemeral: true,
      });
      return;
    }

    const messageInDb = await prisma.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
    });

    if (messageInDb?.expired) {
      await interaction.reply({
        content: 'This message has expired :(',
        ephemeral: true,
      });
      return;
    }

    else if (interaction.user.id != messageInDb?.authorId) {
      await interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
      return;
    }

    const replyRegex = /> .*/g;
    const placeholder = target.embeds[0]?.fields[0]?.value || target.content.replace(`**${interaction.user.tag}:**`, '');

    const modal = new ModalBuilder()
      .setCustomId(interaction.id)
      .setTitle('Edit Message')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setRequired(true)
            .setCustomId('editMessage')
            .setStyle(TextInputStyle.Paragraph)
            .setLabel('Please enter your new message.')
            .setValue(placeholder.replace(replyRegex, '').trim())
            .setMaxLength(950),
        ),
      );

    await interaction.showModal(modal);

    interaction.awaitModalSubmit({ filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 30_000 })
      .then(i => {
        // get the input from user
        const editMessage = i.fields.getTextInputValue('editMessage');
        const censoredEditMessage = wordFiler.censor(editMessage);

        let editEmbed = new EmbedBuilder(target.embeds[0]?.toJSON());
        const reply = editEmbed?.data.fields?.at(0)?.value.match(replyRegex)?.at(0) || target.content.match(replyRegex)?.at(0);

        editEmbed.setFields({
          name: 'Message',
          value: reply ? `${reply}\n${editMessage}` : editMessage,
        });
        let censoredEmbed = new EmbedBuilder(target.embeds[0]?.toJSON())
          .setFields({
            name: 'Message',
            value: reply ? `${reply}\n${censoredEditMessage}` : censoredEditMessage,
          });

        // loop through all the channels in the network and edit the message
        messageInDb.channelAndMessageIds.forEach(async obj => {
          const channelSettings = await prisma.setup.findFirst({
            where: { channelId: obj.channelId },
          });
          const channel = await interaction.client.channels.fetch(obj.channelId) as GuildTextBasedChannel;
          const message = await channel?.messages?.fetch(obj.messageId).catch(() => null);

          // if target message is in compact mode, get the normal mode from another message in the network
          if (!target.embeds[0] && message?.embeds[0]) {
            target.embeds[0] = message.embeds[0]; // updating for message logs
            editEmbed = new EmbedBuilder(message.embeds[0].toJSON()).setFields({
              name: 'Message',
              value: reply ? `${reply}\n${editMessage}` : editMessage,
            });
            censoredEmbed = new EmbedBuilder(message.embeds[0].toJSON()).setFields({
              name: 'Message',
              value: reply ? `${reply}\n${censoredEditMessage}` : censoredEditMessage,
            });
          }

          if (channelSettings?.webhook) {
            const { id, token } = channelSettings.webhook;

            const replyCompact = `${reply}\n ${channelSettings?.profFilter ? editMessage : censoredEditMessage}`;
            const compact = channelSettings?.profFilter ? editMessage : censoredEditMessage;
            const webhookEmbed = channelSettings?.profFilter ? censoredEmbed : editEmbed;
            const webhook = new WebhookClient({ id, token });

            channelSettings?.compact
              ? webhook.editMessage(obj.messageId, reply ? replyCompact : compact)
              : webhook.editMessage(obj.messageId, { files: [], embeds: [webhookEmbed] });
          }

          else {
            const replyFormat = `${reply}\n**${i.user.tag}:** ${channelSettings?.profFilter ? censoredEditMessage : editMessage}`;
            const compactFormat = `**${i.user.tag}:** ${channelSettings?.profFilter ? censoredEditMessage : editMessage}`;
            const normalEmbed = channelSettings?.profFilter ? censoredEmbed : editEmbed;

            channelSettings?.compact
              ? message?.edit(reply ? replyFormat : compactFormat)
              : message?.edit({ files: [], embeds: [normalEmbed] });
          }
        });

        i.reply({ content: `${interaction.client.emoji.normal.yes} Message Edited.`, ephemeral: true });

        const newMessageObject = {
          id: target.id,
          content: editMessage,
          timestamp: target.editedAt ?? target.createdAt,
        };

        interaction.inCachedGuild() ? networkMsgUpdate(interaction.member, target, newMessageObject) : null;

      }).catch((reason) => !reason.message.includes('reason: time') ? logger.error(reason) : null);
  },
};
