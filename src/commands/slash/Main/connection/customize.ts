import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import {
  buildChannelSelect,
  buildCustomizeSelect,
  buildEmbed,
} from '#main/scripts/network/buildConnectionAssets.js';
import { modifyConnection } from '#main/utils/ConnectedList.js';
import { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import {
  getOrCreateWebhook,
  getUserLocale,
  setComponentExpiry,
  simpleEmbed,
} from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import Connection from './index.js';

export default class Customize extends Connection {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const channelId = interaction.options.getString('channel', true).replace(/<#|!|>/g, ''); // in case they mention the channel
    const isInDb = await db.connectedList.findFirst({ where: { channelId } });
    const locale = await getUserLocale(interaction.user.id);

    if (!isInDb) {
      await interaction.editReply({
        embeds: [simpleEmbed(t({ phrase: 'connection.notFound', locale }, { emoji: emojis.no }))],
      });
      return;
    }

    const channelExists = await interaction.guild?.channels.fetch(channelId).catch(() => null);

    if (!channelExists) {
      await modifyConnection({ channelId }, { connected: !isInDb.connected });
      await interaction.followUp({
        content: t({ phrase: 'connection.channelNotFound', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
    }

    const embed = await buildEmbed(
      channelId,
      interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
      locale,
    );
    const customizeSelect = buildCustomizeSelect(channelId, interaction.user.id, locale);
    const channelSelect = buildChannelSelect(channelId, interaction.user.id);

    await interaction.editReply({
      embeds: [embed],
      components: [channelSelect, customizeSelect],
    });

    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 10_000,
    );
  }

  @RegisterInteractionHandler('connectionModal')
  static override async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const locale = await getUserLocale(interaction.user.id);
    if (customId.suffix === 'invite') {
      await interaction.deferReply({ ephemeral: true });

      const invite = interaction.fields.getTextInputValue('connInviteField');
      const [channelId] = customId.args;

      if (!invite) {
        await modifyConnection({ channelId }, { invite: { unset: true } });
        await interaction.followUp({
          content: t({ phrase: 'connection.inviteRemoved', locale }, { emoji: emojis.yes }),
          ephemeral: true,
        });
        return;
      }

      const isValid = await interaction.client?.fetchInvite(invite).catch(() => null);

      if (isValid?.guild?.id !== interaction.guildId) {
        await interaction.followUp({
          content: t({ phrase: 'connection.inviteInvalid', locale }, { emoji: emojis.no }),
          ephemeral: true,
        });
        return;
      }

      await modifyConnection({ channelId }, { invite });

      await interaction.followUp({
        content: t({ phrase: 'connection.inviteAdded', locale }, { emoji: emojis.yes }),
        ephemeral: true,
      });
    }
    else if (customId.suffix === 'embed_color') {
      const embedColor = interaction.fields.getTextInputValue('embed_color');

      const hex_regex = /^#[0-9A-F]{6}$/i;
      if (embedColor && !hex_regex.test(embedColor)) {
        await interaction.reply({
          content: t({ phrase: 'connection.emColorInvalid', locale }, { emoji: emojis.no }),
          ephemeral: true,
        });
        return;
      }

      await modifyConnection(
        { channelId: customId.args[0] },
        { embedColor: embedColor ? embedColor : { unset: true } },
      );

      await interaction.reply({
        content: t(
          { phrase: 'connection.emColorChange', locale },
          { action: embedColor ? `set to \`${embedColor}\`!` : 'unset', emoji: emojis.yes },
        ),
        ephemeral: true,
      });
    }

    await interaction.message
      ?.edit({
        embeds: [
          await buildEmbed(
            customId.args[0],
            interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
            locale,
          ),
        ],
      })
      .catch(() => null);
  }

  @RegisterInteractionHandler('connection')
  static async handleStringSelects(interaction: StringSelectMenuInteraction) {
    if (!interaction.isStringSelectMenu()) return;

    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args.at(0);
    const userIdFilter = customId.args.at(1);
    const locale = await getUserLocale(interaction.user.id);

    if (userIdFilter !== interaction.user.id) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.notYourAction', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    const connection = await db.connectedList.findFirst({ where: { channelId } });
    if (!channelId || !connection) {
      await interaction.reply({
        content: t({ phrase: 'connection.channelNotFound', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    switch (interaction.values[0]) {
      case 'compact':
        await modifyConnection({ channelId }, { compact: !connection.compact });
        break;

      case 'profanity':
        await modifyConnection({ channelId }, { profFilter: !connection.profFilter });
        break;

      case 'invite': {
        const modal = new ModalBuilder()
          .setTitle('Add Invite Link')
          .setCustomId(
            new CustomID().setIdentifier('connectionModal', 'invite').addArgs(channelId).toString(),
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
              .addArgs(channelId)
              .toString(),
          )
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('embed_color')
                .setStyle(TextInputStyle.Short)
                .setLabel('Embed Color')
                .setPlaceholder('Provide a hex color code or leave blank to remove.')
                .setValue(connection.embedColor || '#000000')
                .setRequired(false),
            ),
          );

        await interaction.showModal(modal);
        break;
      }

      default:
        break;
    }

    const newEmbeds = await buildEmbed(
      channelId,
      interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
      locale,
    );
    interaction.replied || interaction.deferred
      ? await interaction.message.edit({ embeds: [newEmbeds] })
      : await interaction.update({ embeds: [newEmbeds] });
  }

  @RegisterInteractionHandler('connection', 'change_channel')
  static async handleChannelSelects(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.isChannelSelectMenu()) return;
    await interaction.deferUpdate();

    const locale = await getUserLocale(interaction.user.id);

    const emoji = emojis.no;
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args.at(0);
    const userIdFilter = customId.args.at(1);

    const newChannel = interaction.channels.first();

    if (!newChannel) {
      await interaction.followUp({
        content: t({ phrase: 'hub.invalidChannel', locale }, { emoji }),
        ephemeral: true,
      });
      return;
    }

    if (userIdFilter !== interaction.user.id) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.notYourAction', locale }, { emoji }))],
        ephemeral: true,
      });
      return;
    }

    const alreadyConnected = await db.connectedList.findFirst({
      where: { channelId: newChannel.id },
    });

    if (alreadyConnected) {
      await interaction.followUp({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'connection.alreadyConnected', locale },
              { channel: `${newChannel?.toString()}`, emoji },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const newWebhook = await getOrCreateWebhook(newChannel as TextChannel | ThreadChannel);
    await modifyConnection(
      { channelId },
      { channelId: newChannel.id, webhookURL: newWebhook?.url },
    );

    const customizeSelect = buildCustomizeSelect(newChannel.id, interaction.user.id, locale);
    const channelSelect = buildChannelSelect(newChannel.id, interaction.user.id);

    await interaction.editReply({
      embeds: [
        await buildEmbed(
          newChannel.id,
          interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
          locale,
        ),
      ],
      components: [channelSelect, customizeSelect],
    });
  }
}
