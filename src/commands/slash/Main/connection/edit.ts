import Constants, { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { isGuildTextBasedChannel } from '#utils/ChannelUtls.js';
import { setComponentExpiry } from '#utils/ComponentUtils.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import {
  buildChannelSelect,
  buildEditEmbed,
  buildEditSelect,
} from '#utils/network/buildConnectionAssets.js';
import { getOrCreateWebhook } from '#utils/Utils.js';
import {
  ActionRowBuilder,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import Connection from './index.js';

export default class ConnectionEditCommand extends Connection {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const channelId =
      interaction.options.getString('channel')?.replace(Constants.Regex.ChannelMention, '') ??
      interaction.channelId;

    const isInDb = await db.connectedList.findFirst({ where: { channelId } });
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!isInDb) {
      await this.replyEmbed(interaction, t('connection.notFound', locale, { emoji: emojis.no }));
      return;
    }

    const channelExists = await interaction.guild?.channels.fetch(channelId).catch(() => null);
    if (!channelExists) {
      await updateConnection({ channelId }, { connected: !isInDb.connected });
      await interaction.followUp({
        content: t('connection.channelNotFound', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
    }

    const iconURL = interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString();

    const embed = await buildEditEmbed(channelId, iconURL, locale);
    const editSelect = buildEditSelect(channelId, interaction.user.id, locale);
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
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (customId.suffix === 'invite') {
      await interaction.deferReply({ ephemeral: true });

      const invite = interaction.fields.getTextInputValue('connInviteField');
      const [channelId] = customId.args;

      if (!invite) {
        await updateConnection({ channelId }, { invite: { unset: true } });
        await interaction.followUp({
          content: t('connection.inviteRemoved', locale, { emoji: emojis.yes }),
          ephemeral: true,
        });
        return;
      }

      const fetchedInvite = await interaction.client?.fetchInvite(invite).catch(() => null);
      if (fetchedInvite?.guild?.id !== interaction.guildId) {
        await interaction.followUp({
          content: t('connection.inviteInvalid', locale, { emoji: emojis.no }),
          ephemeral: true,
        });
        return;
      }

      await updateConnection({ channelId }, { invite });

      await interaction.followUp({
        content: t('connection.inviteAdded', locale, { emoji: emojis.yes }),
        ephemeral: true,
      });
    }
    else if (customId.suffix === 'embed_color') {
      const embedColor = interaction.fields.getTextInputValue('embed_color');

      if (!Constants.Regex.Hexcode.test(embedColor)) {
        await interaction.reply({
          content: t('connection.emColorInvalid', locale, { emoji: emojis.no }),
          ephemeral: true,
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
          emoji: emojis.yes,
        }),
        ephemeral: true,
      });
    }

    await interaction.message
      ?.edit({
        embeds: [
          await buildEditEmbed(
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
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (userIdFilter !== interaction.user.id) {
      const embed = new InfoEmbed().setDescription(
        t('errors.notYourAction', locale, { emoji: emojis.no }),
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const connection = await db.connectedList.findFirst({ where: { channelId } });
    if (!channelId || !connection) {
      await interaction.reply({
        content: t('connection.channelNotFound', locale, { emoji: emojis.no }),
        ephemeral: true,
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

    const newEmbeds = await buildEditEmbed(
      channelId,
      interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
      locale,
    );
    const msgBody = { embeds: [newEmbeds] };

    if (interaction.replied || interaction.deferred) await interaction.message.edit(msgBody);
    else await interaction.update(msgBody);
  }

  @RegisterInteractionHandler('connection', 'change_channel')
  async handleChannelSelects(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.isChannelSelectMenu()) return;
    await interaction.deferUpdate();

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const emoji = emojis.no;
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args.at(0);
    const userIdFilter = customId.args.at(1);

    const newChannel = interaction.channels.first();

    if (!isGuildTextBasedChannel(newChannel) || newChannel.isVoiceBased()) {
      await interaction.followUp({
        content: t('hub.invalidChannel', locale, { emoji }),
        ephemeral: true,
      });
      return;
    }

    if (userIdFilter !== interaction.user.id) {
      const embed = new InfoEmbed().setDescription(t('errors.notYourAction', locale, { emoji }));

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const alreadyConnected = await db.connectedList.findFirst({
      where: { channelId: newChannel.id },
    });

    if (alreadyConnected) {
      const embed = new InfoEmbed().setDescription(
        t('connection.alreadyConnected', locale, { channel: `${newChannel}`, emoji }),
      );

      await interaction.followUp({ embeds: [embed], ephemeral: true });
      return;
    }

    const newWebhook = await getOrCreateWebhook(newChannel);
    await updateConnection(
      { channelId },
      { channelId: newChannel.id, webhookURL: newWebhook?.url },
    );

    const editSelect = buildEditSelect(newChannel.id, interaction.user.id, locale);
    const channelSelect = buildChannelSelect(newChannel.id, interaction.user.id);

    await interaction.editReply({
      embeds: [
        await buildEditEmbed(
          newChannel.id,
          interaction.guild?.iconURL() ?? interaction.user.avatarURL()?.toString(),
          locale,
        ),
      ],
      components: [channelSelect, editSelect],
    });
  }
}
