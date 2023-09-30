import { ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getDb } from '../../Utils/utils';
import { captureException } from '@sentry/node';
import { addServerBlacklist, addUserBlacklist, notifyBlacklist, scheduleUnblacklist } from '../../Utils/blacklist';
import emojis from '../../Utils/JSON/emoji.json';
import parse from 'parse-duration';

export default {
  description: 'Blacklist the user or server that sent the message from the hub.',
  data: new ContextMenuCommandBuilder()
    .setName('Add to Blacklist')
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const messageInDb = await db.messageData.findFirst({ where: {
      channelAndMessageIds: { some: { messageId: interaction.targetId } },
      hub: {
        OR: [
          { moderators: { some: { userId: interaction.user.id } } },
          { ownerId: interaction.user.id },
        ],
      },
    },
    });

    if (!messageInDb) {
      interaction.reply({
        content:
          'This message was not sent in a network, has expired or you lack required permissions to perform this action.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Blacklist')
      .setDescription('Blacklist this server or user from this hub, preventing their messages from being sent.')
      .setColor('Blurple');

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('blacklist_user')
          .setLabel('Blacklist User')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId('blacklist_server')
          .setLabel('Blacklist Server')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏠'),
      );

    const reply = await interaction.reply({ embeds: [embed], components: [buttons] });

    const collector = reply.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, idle: 60000 });
    collector.on('collect', async (i) => {
      if (!messageInDb.hubId) return;

      const modal = new ModalBuilder()
        .setTitle('Blacklist')
        .setCustomId(i.id)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Reason')
              .setPlaceholder('What is the reason for this blacklist?')
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(500),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('duration')
              .setLabel('Duration')
              .setPlaceholder('Duration of the blacklist. Eg. 1d 2h 3m')
              .setStyle(TextInputStyle.Short)
              .setMinLength(2)
              .setRequired(false),
          ),
        );

      await i.showModal(modal);

      const modalResp = await i.awaitModalSubmit({ time: 60000 })
        .catch((e) => {
          !e.message.includes('with reason: time') ? captureException(e) : null;
          return null;
        });

      if (modalResp?.customId !== i.id) return;

      await modalResp.deferUpdate();

      const reason = modalResp.fields.getTextInputValue('reason');
      const duration = parse(modalResp.fields.getTextInputValue('duration'));
      const expires = duration ? new Date(Date.now() + duration) : undefined;

      const successEmbed = new EmbedBuilder()
        .setColor('Green')
        .addFields(
          {
            name: 'Reason',
            value: reason ? reason : 'No reason provided.',
            inline: true,
          },
          {
            name: 'Expires',
            value: expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never.',
            inline: true,
          },
        );


      if (i.customId === 'blacklist_user') {
        const user = await i.client.users.fetch(messageInDb.authorId).catch(() => null);
        successEmbed.setDescription(`${emojis.normal.tick} **${user?.username}** has been successfully blacklisted!`);
        await addUserBlacklist(messageInDb.hubId, i.user, messageInDb.authorId, reason, expires);

        if (expires) scheduleUnblacklist('user', i.client, messageInDb.authorId, messageInDb.hubId, expires);
        if (user) notifyBlacklist(user, messageInDb.hubId, expires, reason).catch(() => null);

        await modalResp.editReply({ embeds: [successEmbed], components: [] });
      }

      else if (i.customId === 'blacklist_server') {
        successEmbed.setDescription(`${emojis.normal.tick} **${i.client.guilds.cache.get(messageInDb.serverId)?.name}** has been successfully blacklisted!`);
        await addServerBlacklist(messageInDb.serverId, i.user, messageInDb.hubId, reason, expires);
        await db.connectedList.deleteMany({ where: { serverId: messageInDb.serverId, hubId: messageInDb.hubId } });

        if (expires) scheduleUnblacklist('server', i.client, messageInDb.serverId, messageInDb.hubId, expires);

        // TODO: Notify server of blacklist

        await modalResp.editReply({ embeds: [successEmbed], components: [] });
      }
    });
  },
};
