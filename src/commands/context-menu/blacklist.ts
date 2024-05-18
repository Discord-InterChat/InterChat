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
  time,
} from 'discord.js';
import db from '../../utils/Db.js';
import parse from 'parse-duration';
import BaseCommand from '../../core/BaseCommand.js';
import { t } from '../../utils/Locale.js';
import { colors, emojis } from '../../utils/Constants.js';
import { CustomID } from '../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { simpleEmbed } from '../../utils/Utils.js';
import { stripIndents } from 'common-tags';
import { logBlacklist } from '../../utils/HubLogger/ModLogs.js';
import { deleteConnections } from '../../utils/ConnectedList.js';

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Blacklist',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const locale = interaction.user.locale;

    const messageInDb = await db.broadcastedMessages.findFirst({
      where: { messageId: interaction.targetId },
      include: { originalMsg: { include: { hub: true } } },
    });

    if (
      !messageInDb ||
      (messageInDb.originalMsg?.hub?.ownerId !== interaction.user.id &&
        !messageInDb.originalMsg?.hub?.moderators.find((mod) => mod.userId === interaction.user.id))
    ) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t({ phrase: 'errors.messageNotSentOrExpired', locale }, { emoji: emojis.info }),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const server = await interaction.client.fetchGuild(messageInDb.originalMsg.serverId);
    const user = await interaction.client.users.fetch(messageInDb.originalMsg.authorId);

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
            .addArgs(messageInDb.originalMsgId)
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('blacklist', 'server')
            .addArgs(interaction.user.id)
            .addArgs(messageInDb.originalMsgId)
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠'),
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  }

  @RegisterInteractionHandler('blacklist')
  static override async handleComponents(interaction: MessageComponentInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);

    if (interaction.user.id !== customId.args[0]) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.notYourAction', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
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
            .setLabel(
              t({ phrase: 'blacklist.modal.reason.label', locale: interaction.user.locale }),
            )
            .setPlaceholder(
              t({ phrase: 'blacklist.modal.reason.placeholder', locale: interaction.user.locale }),
            )
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(
              t({ phrase: 'blacklist.modal.duration.label', locale: interaction.user.locale }),
            )
            .setPlaceholder(
              t({
                phrase: 'blacklist.modal.duration.placeholder',
                locale: interaction.user.locale,
              }),
            )
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
    const messageId = customId.args[0];
    const originalMsg = await db.originalMessages.findFirst({ where: { messageId } });

    if (!originalMsg?.hubId) {
      await interaction.editReply(
        t(
          { phrase: 'errors.networkMessageExpired', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
      );
      return;
    }

    const reason = interaction.fields.getTextInputValue('reason');
    const duration = parse(interaction.fields.getTextInputValue('duration'));
    const expires = duration ? new Date(Date.now() + duration) : undefined;

    const successEmbed = new EmbedBuilder().setColor('Green').addFields(
      {
        name: 'Reason',
        value: reason ? reason : t({ phrase: 'misc.noReason', locale: interaction.user.locale }),
        inline: true,
      },
      {
        name: 'Expires',
        value: expires ? `${time(Math.round(expires.getTime() / 1000), 'R')}` : 'Never.',
        inline: true,
      },
    );

    const blacklistManager = interaction.client.blacklistManager;

    // user blacklist
    if (customId.suffix === 'user') {
      const user = await interaction.client.users.fetch(originalMsg.authorId).catch(() => null);
      successEmbed.setDescription(
        t(
          { phrase: 'blacklist.user.success', locale: interaction.user.locale },
          { username: user?.username ?? 'Unknown User', emoji: emojis.tick },
        ),
      );
      await blacklistManager.addUserBlacklist(
        originalMsg.hubId,
        originalMsg.authorId,
        reason,
        interaction.user.id,
        expires,
      );

      if (expires) {
        blacklistManager.scheduleRemoval('user', originalMsg.authorId, originalMsg.hubId, expires);
      }
      if (user) {
        blacklistManager
          .notifyBlacklist('user', originalMsg.authorId, originalMsg.hubId, expires, reason)
          .catch(() => null);

        await logBlacklist(originalMsg.hubId, {
          userOrServer: user,
          mod: interaction.user,
          reason,
          expires,
        });
      }

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }

    // server blacklist
    else {
      const server = interaction.client.guilds.cache.get(originalMsg.serverId);

      successEmbed.setDescription(
        t(
          { phrase: 'blacklist.server.success', locale: interaction.user.locale },
          { server: server?.name ?? 'Unknown Server', emoji: emojis.tick },
        ),
      );

      await blacklistManager.addServerBlacklist(
        originalMsg.serverId,
        originalMsg.hubId,
        reason,
        interaction.user.id,
        expires,
      );

      // Notify server of blacklist
      await blacklistManager.notifyBlacklist(
        'server',
        originalMsg.serverId,
        originalMsg.hubId,
        expires,
        reason,
      );

      if (expires) {
        blacklistManager.scheduleRemoval(
          'server',
          originalMsg.serverId,
          originalMsg.hubId,
          expires,
        );
      }

      await deleteConnections({
        serverId: originalMsg.serverId,
        hubId: originalMsg.hubId,
      });

      if (server) {
        await logBlacklist(originalMsg.hubId, {
          userOrServer: server,
          mod: interaction.user,
          reason,
          expires,
        }).catch(() => null);
      }

      await interaction.editReply({ embeds: [successEmbed], components: [] });
    }
  }
}
