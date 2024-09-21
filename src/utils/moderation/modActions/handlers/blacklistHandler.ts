import { emojis } from '#main/config/Constants.js';
import { deleteConnections } from '#main/utils/ConnectedList.js';
import { CustomID } from '#main/utils/CustomID.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import { ModAction, ModActionsDbMsgT } from '#main/utils/moderation/modActions/utils.js';
import { simpleEmbed } from '#main/utils/Utils.js';
import { ActionRowBuilder, ButtonInteraction, EmbedBuilder, ModalBuilder, ModalSubmitInteraction, Snowflake, TextInputBuilder, TextInputStyle, time } from 'discord.js';
import parse from 'parse-duration';

abstract class BaseBlacklistHandler implements ModAction {
  abstract handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ): Promise<void>;

  abstract handleModal(
    interaction: ModalSubmitInteraction,
    originalMsg: ModActionsDbMsgT,
    locale: supportedLocaleCodes,
  ): Promise<void>;

  buildModal(
    title: string,
    type: 'user' | 'server',
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    return new ModalBuilder()
      .setTitle(title)
      .setCustomId(
        new CustomID().setIdentifier('blacklist_modal', type).addArgs(originalMsgId).toString(),
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
  }

  protected getModalData(interaction: ModalSubmitInteraction) {
    const reason = interaction.fields.getTextInputValue('reason');
    const duration = parse(interaction.fields.getTextInputValue('duration'));
    const expires = duration ? new Date(Date.now() + duration) : null;

    return { reason, expires };
  }

  protected buildSuccessEmbed(
    name: string,
    reason: string,
    expires: Date | null,
    locale: supportedLocaleCodes,
  ) {
    return new EmbedBuilder()
      .setColor('Green')
      .setDescription(t({ phrase: 'blacklist.success', locale }, { name, emoji: emojis.tick }))
      .addFields(
        {
          name: 'Reason',
          value: reason ?? t({ phrase: 'misc.noReason', locale }),
          inline: true,
        },
        {
          name: 'Expires',
          value: expires ? `${time(Math.round(expires.getTime() / 1000), 'R')}` : 'Never.',
          inline: true,
        },
      );
  }
}

export class BlacklistUserHandler extends BaseBlacklistHandler {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    await interaction.showModal(this.buildModal('Blacklist User', 'user', originalMsgId, locale));
  }

  async handleModal(
    interaction: ModalSubmitInteraction,
    originalMsg: ModActionsDbMsgT,
    locale: supportedLocaleCodes,
  ) {
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

    if (!originalMsg.hubId) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    const { userManager } = interaction.client;
    const { reason, expires } = this.getModalData(interaction);

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
      `User ${user?.username} blacklisted by ${interaction.user.username} in ${originalMsg.hub?.name}`,
    );

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: [buttons] });

    const successEmbed = this.buildSuccessEmbed(user.username, reason, expires, locale);
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
  }
}

export class BlacklistServerHandler extends BaseBlacklistHandler {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    await interaction.showModal(
      this.buildModal('Blacklist Server', 'server', originalMsgId, locale),
    );
  }

  async handleModal(
    interaction: ModalSubmitInteraction,
    originalMsg: ModActionsDbMsgT,
    locale: supportedLocaleCodes,
  ) {
    if (!originalMsg.hubId) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    const server = await interaction.client.fetchGuild(originalMsg.serverId);
    if (!server) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.unknownServer', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    const { serverBlacklists } = interaction.client;
    const { reason, expires } = this.getModalData(interaction);

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

    const successEmbed = this.buildSuccessEmbed(server.name, reason, expires, locale);

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
  }
}
