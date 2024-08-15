import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { deleteConnections } from '#main/utils/ConnectedList.js';
import { colors, emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import { t } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { isStaffOrHubMod } from '#main/utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  type ModalSubmitInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
} from 'discord.js';
import parse from 'parse-duration';

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Blacklist',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const messageInDb = await this.fetchMessageFromDb(interaction.targetId, {
      hub: true,
      broadcastMsgs: true,
    });

    if (!messageInDb?.hub || !isStaffOrHubMod(interaction.user.id, messageInDb.hub)) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.messageNotSentOrExpired', locale }, { emoji: emojis.info }),
        { ephemeral: true },
      );

      return;
    }

    if (messageInDb.authorId === interaction.user.id) {
      await interaction.reply({
        content: '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t blacklist yourself.',
        ephemeral: true,
      });
      return;
    }

    const user = await interaction.client.users.fetch(messageInDb.authorId);
    const server = await interaction.client.fetchGuild(messageInDb.serverId);

    const embed = new EmbedBuilder()
      .setTitle('Create A Blacklist')
      .setColor(colors.invisible)
      .setFooter({ text: t({ phrase: 'blacklist.embed.footer', locale }) })
      .setDescription(stripIndents`
          **${t({ phrase: 'blacklist.embed.user', locale })}:** ${emojis.arrow} ${t({ phrase: 'blacklist.embed.userValue', locale }, { user: user.username })}
          **${t({ phrase: 'blacklist.embed.server', locale })}:** ${emojis.arrow} ${t({ phrase: 'blacklist.embed.serverValue', locale }, { server: `${server?.name}` })}
      `);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('blacklist', 'user')
            .addArgs(interaction.user.id)
            .addArgs(messageInDb.messageId)
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('blacklist', 'server')
            .addArgs(interaction.user.id)
            .addArgs(messageInDb.messageId)
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠'),
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
  }

  @RegisterInteractionHandler('blacklist')
  override async handleComponents(interaction: MessageComponentInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (interaction.user.id !== customId.args[0]) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.notYourAction', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const originalMsgId = customId.args[1];
    const modal = new ModalBuilder()
      .setTitle('Blacklist')
      .setCustomId(
        new CustomID()
          .setIdentifier('blacklist_modal', customId.suffix)
          .addArgs(originalMsgId)
          .toString(),
      )
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel(t({ phrase: 'blacklist.modal.reason.label', locale }))
            .setPlaceholder(t({ phrase: 'blacklist.modal.reason.placeholder', locale }))
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(t({ phrase: 'blacklist.modal.duration.label', locale }))
            .setPlaceholder(t({ phrase: 'blacklist.modal.duration.placeholder', locale }))
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setRequired(false),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('blacklist_modal')
  override async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;
    const originalMsg = await this.fetchMessageFromDb(messageId);

    if (!originalMsg?.hubId) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const reason = interaction.fields.getTextInputValue('reason');
    const duration = parse(interaction.fields.getTextInputValue('duration'));
    const expires = duration ? new Date(Date.now() + duration) : null;

    const successEmbed = new EmbedBuilder().setColor('Green').addFields(
      {
        name: 'Reason',
        value: reason ? reason : t({ phrase: 'misc.noReason', locale }),
        inline: true,
      },
      {
        name: 'Expires',
        value: expires ? `${time(Math.round(expires.getTime() / 1000), 'R')}` : 'Never.',
        inline: true,
      },
    );

    // user blacklist
    if (customId.suffix === 'user') {
      const user = await interaction.client.users.fetch(originalMsg.authorId).catch(() => null);

      if (!user) {
        await this.replyEmbed(
          interaction,
          `${emojis.neutral} Unable to fetch user. They may have deleted their account?`,
          { ephemeral: true },
        );
        return;
      }

      successEmbed.setDescription(
        t(
          { phrase: 'blacklist.user.success', locale },
          { username: user?.username ?? 'Unknown User', emoji: emojis.tick },
        ),
      );

      await userManager.addBlacklist({ id: user.id, name: user.username }, originalMsg.hubId, {
        reason,
        moderatorId: interaction.user.id,
        expires,
      });

      if (user) {
        userManager
          .sendNotification({ target: user, hubId: originalMsg.hubId, expires, reason })
          .catch(() => null);

        await logBlacklist(originalMsg.hubId, interaction.client, {
          target: user,
          mod: interaction.user,
          reason,
          expires,
        });
      }

      Logger.info(
        `User ${user?.username} blacklisted by ${interaction.user.username} in ${originalMsg.hubId}`,
      );

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }

    // server blacklist
    else {
      const { serverBlacklists } = interaction.client;
      const server = await interaction.client.fetchGuild(originalMsg.serverId);

      successEmbed.setDescription(
        t(
          { phrase: 'blacklist.server.success', locale },
          { server: server?.name ?? 'Unknown Server', emoji: emojis.tick },
        ),
      );

      await serverBlacklists.addBlacklist(
        { name: server?.name ?? 'Unknown Server', id: originalMsg.serverId },
        originalMsg.hubId,
        {
          reason,
          moderatorId: interaction.user.id,
          expires,
        },
      );

      // Notify server of blacklist
      await serverBlacklists.sendNotification({
        target: { id: originalMsg.serverId },
        hubId: originalMsg.hubId,
        expires,
        reason,
      });

      await deleteConnections({ serverId: originalMsg.serverId, hubId: originalMsg.hubId });

      if (server) {
        await logBlacklist(originalMsg.hubId, interaction.client, {
          target: server.id,
          mod: interaction.user,
          reason,
          expires,
        }).catch(() => null);
      }

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }
  }

  // utils
  private async fetchMessageFromDb(
    messageId: string,
    include: { hub: boolean; broadcastMsgs: boolean } = { hub: false, broadcastMsgs: false },
  ) {
    let messageInDb = await db.originalMessages.findFirst({
      where: { messageId },
      include,
    });

    if (!messageInDb) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId },
        include: { originalMsg: { include } },
      });

      messageInDb = broadcastedMsg?.originalMsg ?? null;
    }

    return messageInDb;
  }
}
