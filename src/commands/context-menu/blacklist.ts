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
import { checkIfStaff, simpleEmbed } from '../../utils/Utils.js';
import { stripIndents } from 'common-tags';
import { logBlacklist } from '../../utils/HubLogger/ModLogs.js';
import { deleteConnections } from '../../utils/ConnectedList.js';
import Logger from '../../utils/Logger.js';

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Blacklist',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const { locale } = interaction.user;

    const messageInDb = await db.broadcastedMessages.findFirst({
      where: { messageId: interaction.targetId },
      include: { originalMsg: { include: { hub: true } } },
    });

    const isHubMod =
      messageInDb?.originalMsg?.hub?.ownerId === interaction.user.id ||
      messageInDb?.originalMsg?.hub?.moderators.find((mod) => mod.userId === interaction.user.id);

    const isStaffOrHubMod = checkIfStaff(interaction.user.id) || isHubMod;

    if (!messageInDb || !isStaffOrHubMod) {
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

    if (messageInDb.originalMsg.authorId === interaction.user.id) {
      await interaction.reply({
        content: '<a:nuhuh:1256859727158050838> Nuh uh! You\'re stuck with us.',
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

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
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

    const { locale } = interaction.user;
    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;
    const originalMsg = await db.originalMessages.findFirst({ where: { messageId } });

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

    const { userManager } = interaction.client;

    // user blacklist
    if (customId.suffix === 'user') {
      const user = await interaction.client.users.fetch(originalMsg.authorId).catch(() => null);

      if (!user) {
        await interaction.reply({
          embeds: [
            simpleEmbed(
              `${emojis.neutral} Unable to fetch user. They may have deleted their account?`,
            ),
          ],
          ephemeral: true,
        });
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
}
