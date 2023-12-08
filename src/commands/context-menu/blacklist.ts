import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import BaseCommand from '../BaseCommand.js';
import db from '../../utils/Db.js';
import { colors, emojis } from '../../utils/Constants.js';
import { CustomID } from '../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { errorEmbed } from '../../utils/Utils.js';
import parse from 'parse-duration';
import NetworkLogger from '../../utils/NetworkLogger.js';
import { __ } from '../../utils/Locale.js';

export default class Blacklist extends BaseCommand {
  data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Blacklist',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const messageInDb = await db.messageData.findFirst({
      where: {
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
        embeds: [
          errorEmbed(
            __(
              { phrase: 'errors.messageNotSentOrExpired', locale: interaction.user.locale },
              { emoji: emojis.info },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Blacklist')
      .setDescription(
        // FIXME: either remove or improve this
        'Blacklist the server or user of this message from this hub. This will prevent messages by them from being sent.',
      )
      .setColor(colors.interchatBlue);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('blacklist', 'user')
            .addArgs(interaction.user.id)
            .addArgs(messageInDb.id)
            .addArgs('u=1')
            .toString(),
        )
        .setLabel('Blacklist User')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('blacklist', 'server')
            .addArgs(interaction.user.id)
            .addArgs(messageInDb.id)
            .addArgs('s=1')
            .toString(),
        )
        .setLabel('Blacklist Server')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠'),
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  }

  @RegisterInteractionHandler('blacklist')
  async handleComponents(interaction: MessageComponentInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);

    if (interaction.user.id !== customId.args[0]) {
      await interaction.reply({
        embeds: [
          errorEmbed(__({ phrase: 'errors.cannotPerformAction', locale: interaction.user.locale })),
        ],
        ephemeral: true,
      });
      return;
    }

    const messageDocId = customId.args[1];
    const blacklistType = customId.args[2];

    const modal = new ModalBuilder()
      .setTitle('Blacklist')
      .setCustomId(
        new CustomID()
          .setIdentifier('blacklist_modal')
          .addArgs(messageDocId)
          .addArgs(blacklistType)
          .toString(),
      )
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

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('blacklist_modal')
  async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const messageDocId = customId.args[0];
    const blacklistType = customId.args[1];

    const messageInDb = await db.messageData.findFirst({
      where: { id: messageDocId },
    });

    if (!messageInDb?.hubId) {
      await interaction.reply({
        content: __({ phrase: 'errors.networkMessageExpired', locale: interaction.user.locale }),
        ephemeral: true,
      });
      return;
    }

    const reason = interaction.fields.getTextInputValue('reason');
    const duration = parse(interaction.fields.getTextInputValue('duration'));
    const expires = duration ? new Date(Date.now() + duration) : undefined;

    const successEmbed = new EmbedBuilder().setColor('Green').addFields(
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

    const blacklistManager = interaction.client.getBlacklistManager();

    // user blacklist
    if (blacklistType.startsWith('u=')) {
      const user = await interaction.client.users.fetch(messageInDb.authorId).catch(() => null);
      successEmbed.setDescription(
        __(
          { phrase: 'blacklist.user.success', locale: interaction.user.locale },
          { username: user?.username ?? 'Unknown User', emoji: emojis.tick },
        ),
      );
      await blacklistManager.addUserBlacklist(
        messageInDb.hubId,
        messageInDb.authorId,
        reason,
        interaction.user.id,
        expires,
      );

      if (expires) {
        blacklistManager.scheduleRemoval('user', messageInDb.authorId, messageInDb.hubId, expires);
      }
      if (user) {
        blacklistManager
          .notifyBlacklist('user', messageInDb.authorId, messageInDb.hubId, expires, reason)
          .catch(() => null);

        const networkLogger = new NetworkLogger(messageInDb.hubId);
        await networkLogger.logBlacklist(user, interaction.user, reason, expires);
      }

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }

    // server blacklist
    else {
      const server = interaction.client.guilds.cache.get(messageInDb.serverId);

      successEmbed.setDescription(
        __(
          { phrase: 'blacklist.server.success', locale: interaction.user.locale },
          { username: server?.name ?? 'Unknown Server', emoji: emojis.tick },
        ),
      );

      await blacklistManager.addServerBlacklist(
        messageInDb.serverId,
        messageInDb.hubId,
        reason,
        interaction.user.id,
        expires,
      );

      // Notify server of blacklist
      await blacklistManager.notifyBlacklist(
        'server',
        messageInDb.serverId,
        messageInDb.hubId,
        expires,
        reason,
      );

      if (expires) {
        blacklistManager.scheduleRemoval(
          'server',
          messageInDb.serverId,
          messageInDb.hubId,
          expires,
        );
      }

      await db.connectedList.deleteMany({
        where: { serverId: messageInDb.serverId, hubId: messageInDb.hubId },
      });

      if (server) {
        const networkLogger = new NetworkLogger(messageInDb.hubId);
        await networkLogger
          .logBlacklist(server, interaction.user, reason, expires)
          .catch(() => null);
      }

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }
  }
}
