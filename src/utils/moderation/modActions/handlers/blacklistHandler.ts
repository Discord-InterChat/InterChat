import { emojis } from '#utils/Constants.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { OriginalMessage } from '#main/utils/network/messageUtils.js';
import { deleteConnections } from '#utils/ConnectedListUtils.js';
import { CustomID } from '#utils/CustomID.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import Logger from '#utils/Logger.js';
import { sendBlacklistNotif } from '#utils/moderation/blacklistUtils.js';
import modActionsPanel from '#utils/moderation/modActions/modActionsPanel.js';
import { type ModAction } from '#utils/moderation/modActions/utils.js';
import {
  ActionRowBuilder,
  type ButtonInteraction,
  EmbedBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  type Snowflake,
  TextInputBuilder,
  TextInputStyle,
  time,
} from 'discord.js';
import ms from 'ms';

abstract class BaseBlacklistHandler implements ModAction {
  abstract handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ): Promise<void>;

  abstract handleModal(
    interaction: ModalSubmitInteraction,
    originalMsg: OriginalMessage,
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
            .setLabel(t('blacklist.modal.reason.label', locale))
            .setPlaceholder(t('blacklist.modal.reason.placeholder', locale))
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(t('blacklist.modal.duration.label', locale))
            .setPlaceholder(t('blacklist.modal.duration.placeholder', locale))
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setRequired(false),
        ),
      );
  }

  protected getModalData(interaction: ModalSubmitInteraction) {
    const reason = interaction.fields.getTextInputValue('reason');
    const duration = ms(interaction.fields.getTextInputValue('duration'));
    const expiresAt = duration ? new Date(Date.now() + duration) : null;

    return { reason, expiresAt };
  }

  protected buildSuccessEmbed(
    name: string,
    reason: string,
    expires: Date | null,
    locale: supportedLocaleCodes,
  ) {
    return new EmbedBuilder()
      .setColor('Green')
      .setDescription(t('blacklist.success', locale, { name, emoji: emojis.tick }))
      .addFields(
        {
          name: 'Reason',
          value: reason ?? t('misc.noReason', locale),
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
    originalMsg: OriginalMessage,
    locale: supportedLocaleCodes,
  ) {
    const user = await interaction.client.users.fetch(originalMsg.authorId).catch(() => null);

    if (!user) {
      await interaction.reply({
        content: `${emojis.neutral} Unable to fetch user. They may have deleted their account?`,
        ephemeral: true,
      });
      return;
    }

    if (!originalMsg.hubId) {
      await interaction.reply({
        content: t('hub.notFound_mod', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    if (originalMsg.authorId === interaction.user.id) {
      await interaction.followUp({
        content: '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t blacklist yourself.',
        ephemeral: true,
      });
      return;
    }

    const { reason, expiresAt } = this.getModalData(interaction);
    const blacklistManager = new BlacklistManager(new UserInfractionManager(user.id));

    await blacklistManager.addBlacklist({
      hubId: originalMsg.hubId,
      moderatorId: interaction.user.id,
      reason,
      expiresAt,
    });

    if (user) {
      sendBlacklistNotif('user', interaction.client, {
        expiresAt,
        target: user,
        hubId: originalMsg.hubId,
        reason,
      }).catch(() => null);

      await blacklistManager.log(originalMsg.hubId, interaction.client, {
        mod: interaction.user,
        reason,
        expiresAt,
      });
    }

    Logger.info(
      `User ${user?.username} blacklisted by ${interaction.user.username} in ${originalMsg.hubId}`,
    );

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: buttons });

    const successEmbed = this.buildSuccessEmbed(user.username, reason, expiresAt, locale);
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
    originalMsg: OriginalMessage,
    locale: supportedLocaleCodes,
  ) {
    if (!originalMsg.hubId) {
      await interaction.reply({
        content: t('hub.notFound_mod', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const server = await interaction.client.fetchGuild(originalMsg.guildId);
    if (!server) {
      await interaction.reply({
        content: t('errors.unknownServer', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const { reason, expiresAt } = this.getModalData(interaction);
    const blacklistManager = new BlacklistManager(new ServerInfractionManager(originalMsg.guildId));

    await blacklistManager.addBlacklist({
      reason,
      expiresAt,
      hubId: originalMsg.hubId,
      serverName: server?.name ?? 'Unknown Server',
      moderatorId: interaction.user.id,
    });

    // Notify server of blacklist
    await sendBlacklistNotif('server', interaction.client, {
      target: { id: originalMsg.guildId },
      hubId: originalMsg.hubId,
      expiresAt,
      reason,
    });

    await deleteConnections({ serverId: originalMsg.guildId, hubId: originalMsg.hubId });

    if (server) {
      await blacklistManager.log(originalMsg.hubId, interaction.client, {
        mod: interaction.user,
        reason,
        expiresAt,
      }).catch(() => null);
    }

    const successEmbed = this.buildSuccessEmbed(server.name, reason, expiresAt, locale);

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: buttons });
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
  }
}
