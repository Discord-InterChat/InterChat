import {
  ActionRowBuilder,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import Logger from '#main/utils/Logger.js';
import { isGuildTextBasedChannel } from '#utils/ChannelUtls.js';
import { setComponentExpiry } from '#utils/ComponentUtils.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import Constants from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import { fetchUserLocale, getOrCreateWebhook } from '#utils/Utils.js';
import {
  buildChannelSelect,
  buildEditEmbed,
  buildEditSelect,
} from '#utils/network/buildConnectionAssets.js';
import Connection from './index.js';

export default class ConnectionEditCommand extends Connection {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const channelId =
      interaction.options.getString('channel')?.replace(Constants.Regex.ChannelMention, '') ??
      interaction.channelId;

    const isInDb = await db.connection.findFirst({ where: { channelId } });
    const locale = await this.getLocale(interaction);

    if (!isInDb) {
      await this.replyEmbed(
        interaction,
        t('connection.notFound', locale, { emoji: this.getEmoji('x_icon') }),
      );
      return;
    }

    const channelExists = await interaction.guild?.channels.fetch(channelId).catch(() => null);
    if (!channelExists) {
      await updateConnection({ channelId }, { connected: !isInDb.connected });
      await interaction.followUp({
        content: t('connection.channelNotFound', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        flags: ['Ephemeral'],
      });
    }

    const iconURL = interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString();

    const embed = await buildEditEmbed(interaction.client, channelId, iconURL, locale);
    const editSelect = buildEditSelect(interaction.client, channelId, interaction.user.id, locale);
    const channelSelect = buildChannelSelect(channelId, interaction.user.id);

    await interaction.editReply({
      embeds: [embed],
      components: [channelSelect, editSelect],
    });

    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 10_000,
    );
  }

  @RegisterInteractionHandler('connectionModal')
  async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const locale = await this.getLocale(interaction);

    if (customId.suffix === 'invite') {
      await interaction.deferReply({ flags: ['Ephemeral'] });

      const invite = interaction.fields.getTextInputValue('connInviteField');
      const [channelId] = customId.args;

      if (!invite) {
        await updateConnection({ channelId }, { invite: { unset: true } });
        await interaction.followUp({
          content: t('connection.inviteRemoved', locale, {
            emoji: this.getEmoji('tick_icon'),
          }),
          flags: ['Ephemeral'],
        });
        return;
      }

      const fetchedInvite = await interaction.client?.fetchInvite(invite).catch(() => null);
      if (fetchedInvite?.guild?.id !== interaction.guildId) {
        await interaction.followUp({
          content: t('connection.inviteInvalid', locale, {
            emoji: this.getEmoji('x_icon'),
          }),
          flags: ['Ephemeral'],
        });
        return;
      }

      await updateConnection({ channelId }, { invite });

      await interaction.followUp({
        content: t('connection.inviteAdded', locale, {
          emoji: this.getEmoji('tick_icon'),
        }),
        flags: ['Ephemeral'],
      });
    }
    else if (customId.suffix === 'embed_color') {
      const embedColor = interaction.fields.getTextInputValue('embed_color');

      if (!Constants.Regex.Hexcode.test(embedColor)) {
        await interaction.reply({
          content: t('connection.emColorInvalid', locale, {
            emoji: this.getEmoji('x_icon'),
          }),
          flags: ['Ephemeral'],
        });
        return;
      }

      await updateConnection(
        { channelId: customId.args[0] },
        { embedColor: embedColor ?? { unset: true } },
      );

      await interaction.reply({
        content: t('connection.emColorChange', locale, {
          action: embedColor ? `set to \`${embedColor}\`!` : 'unset',
          emoji: this.getEmoji('tick_icon'),
        }),
        flags: ['Ephemeral'],
      });
    }

    await interaction.message
      ?.edit({
        embeds: [
          await buildEditEmbed(
            interaction.client,
            customId.args[0],
            interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
            locale,
          ),
        ],
      })
      .catch(() => null);
  }

  @RegisterInteractionHandler('connection')
  async handleStringSelects(interaction: StringSelectMenuInteraction) {
    if (!interaction.isStringSelectMenu()) return;

    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args.at(0);
    const userIdFilter = customId.args.at(1);

    const locale = await fetchUserLocale(interaction.user.id);

    if (userIdFilter !== interaction.user.id) {
      const embed = new InfoEmbed().setDescription(
        t('errors.notYourAction', locale, { emoji: this.getEmoji('x_icon') }),
      );
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    const connection = await db.connection.findFirst({ where: { channelId } });
    if (!channelId || !connection) {
      await interaction.reply({
        content: t('connection.channelNotFound', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        flags: ['Ephemeral'],
      });
      return;
    }

    switch (interaction.values[0]) {
      case 'compact':
        await updateConnection({ channelId }, { compact: !connection.compact });
        break;

      case 'profanity':
        await updateConnection({ channelId }, { profFilter: !connection.profFilter });
        break;

      case 'invite': {
        const modal = new ModalBuilder()
          .setTitle('Add Invite Link')
          .setCustomId(
            new CustomID().setIdentifier('connectionModal', 'invite').setArgs(channelId).toString(),
          )
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setLabel('Invite Link')
                .setValue('https://discord.gg/')
                .setCustomId('connInviteField')
                .setRequired(false)
                .setStyle(TextInputStyle.Short),
            ),
          );

        await interaction.showModal(modal);
        break;
      }
      case 'embed_color': {
        const modal = new ModalBuilder()
          .setTitle('Set Embed Color')
          .setCustomId(
            new CustomID()
              .setIdentifier('connectionModal', 'embed_color')
              .setArgs(channelId)
              .toString(),
          )
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('embed_color')
                .setStyle(TextInputStyle.Short)
                .setLabel('Embed Color')
                .setPlaceholder('Provide a hex color code or leave blank to remove.')
                .setValue(connection.embedColor ?? '#000000')
                .setRequired(false),
            ),
          );

        await interaction.showModal(modal);
        break;
      }

      default:
        break;
    }

    const newEmbeds = await buildEditEmbed(
      interaction.client,
      channelId,
      interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
      locale,
    );
    const msgBody = { embeds: [newEmbeds] };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.message.edit(msgBody);
      }
      else {
        await interaction.update(msgBody);
      }
    }
    catch (e) {
      Logger.error('[/connection edit] Error updating message', e);
    }
  }

  @RegisterInteractionHandler('connection', 'change_channel')
  async handleChannelSelects(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.isChannelSelectMenu()) return;
    await interaction.deferUpdate();

    const locale = await fetchUserLocale(interaction.user.id);

    const emoji = this.getEmoji('x_icon');
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args.at(0);
    const userIdFilter = customId.args.at(1);

    const newChannel = interaction.channels.first();

    if (!isGuildTextBasedChannel(newChannel) || newChannel.isVoiceBased()) {
      await interaction.followUp({
        content: t('hub.invalidChannel', locale, { emoji }),
        flags: ['Ephemeral'],
      });
      return;
    }

    if (userIdFilter !== interaction.user.id) {
      const embed = new InfoEmbed().setDescription(t('errors.notYourAction', locale, { emoji }));

      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    const alreadyConnected = await db.connection.findFirst({
      where: { channelId: newChannel.id },
    });

    if (alreadyConnected) {
      const embed = new InfoEmbed().setDescription(
        t('connection.alreadyConnected', locale, {
          channel: `${newChannel}`,
          emoji,
        }),
      );

      await interaction.followUp({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    const newWebhook = await getOrCreateWebhook(newChannel);
    await updateConnection(
      { channelId },
      {
        channelId: newChannel.id,
        webhookURL: newWebhook?.url,
        parentId: newChannel.isThread() ? newChannel.parentId : null,
      },
    );

    const editSelect = buildEditSelect(
      interaction.client,
      newChannel.id,
      interaction.user.id,
      locale,
    );
    const channelSelect = buildChannelSelect(newChannel.id, interaction.user.id);

    await interaction.editReply({
      embeds: [
        await buildEditEmbed(
          interaction.client,
          newChannel.id,
          interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
          locale,
        ),
      ],
      components: [channelSelect, editSelect],
    });
  }
}
