import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  RESTPostAPIApplicationCommandsJSONBody,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import db from '../../../utils/Db.js';
import { RegisterInteractionHandler } from '../../../decorators/Interaction.js';
import { buildEmbed } from '../../../scripts/network/buildEmbed.js';
import { buildConnectionButtons } from '../../../scripts/network/components.js';
import { emojis } from '../../../utils/Constants.js';
import { CustomID } from '../../../utils/CustomID.js';
import {
  disableComponents,
  errorEmbed,
  getOrCreateWebhook,
  setComponentExpiry,
} from '../../../utils/Utils.js';
import { __ } from '../../../utils/Locale.js';

export default class Connection extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'connection',
    description: 'Manage your connections in this server.',
    default_member_permissions: `${PermissionFlagsBits.ManageMessages}`,
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'channel',
        description: 'Choose a connection to manage.',
        required: true,
        autocomplete: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const networkManager = interaction.client.getNetworkManager();
    const channelId = interaction.options.getString('channel', true).replace(/<#|!|>/g, ''); // in case they mention the channel
    const isInDb = await networkManager.fetchConnection({ channelId });

    if (!isInDb) {
      await interaction.reply({
        embeds: [
          errorEmbed(__({ phrase: 'connection.notFound', locale: interaction.user.locale })),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = await buildEmbed(interaction, channelId);
    const buttons = buildConnectionButtons(true, channelId, { userId: interaction.user.id });

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

    const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('connection', 'settings')
            .addArgs(channelId)
            .addArgs(interaction.user.id)
            .toString(),
        )
        .setPlaceholder('🛠️ Select a setting to toggle')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Compact')
            .setEmoji(emojis.clipart)
            .setDescription('Disable embeds in the network to fit more messages.')
            .setValue('compact'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Profanity Filter')
            .setEmoji('🤬')
            .setDescription('Toggle swear word censoring for this server.')
            .setValue('profanity'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Invite Link')
            .setEmoji(emojis.members)
            .setDescription('Set an invite for network users to join your server easily!')
            .setValue('invite'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Switch Channel')
            .setEmoji(emojis.store)
            .setDescription('Set a different channel for the network.')
            .setValue('change_channel'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Embed Color')
            .setEmoji('🎨')
            .setDescription('Set the color of the embeds sent in the network.')
            .setValue('embed_color'),
        ),
    ]);

    const channelExists = await interaction.guild?.channels.fetch(channelId).catch(() => null);

    if (!channelExists) {
      await networkManager.updateConnection(
        { channelId: channelId },
        { connected: !isInDb.connected },
      );
      await interaction.followUp({
        content: __({ phrase: 'connection.channelNotFound', locale: interaction.user.locale }),
        ephemeral: true,
      });
    }

    await interaction.editReply({
      embeds: [embed],
      components: [customizeMenu, buttons],
    });

    // TODO Button expiration
    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 10_000,
    );
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused();

    const isInDb = await db.connectedList.findMany({
      where: {
        serverId: interaction.guild?.id,
        OR: [
          { channelId: { contains: focusedValue } },
          { hub: { name: { contains: focusedValue } } },
        ],
      },
      select: { channelId: true, hub: true },
      take: 25,
    });

    const filtered = isInDb?.map(async ({ channelId, hub }) => {
      const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
      return { name: `${hub?.name} | #${channel?.name || channelId}`, value: channelId };
    });

    interaction.respond(await Promise.all(filtered));
  }

  @RegisterInteractionHandler('connection')
  async handleComponents(interaction: MessageComponentInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args[0];

    if (customId.args.at(1) && customId.args[1] !== interaction.user.id) {
      await interaction.reply({
        embeds: [
          errorEmbed(__({ phrase: 'errors.cannotPerformAction', locale: interaction.user.locale })),
        ],
        ephemeral: true,
      });
      return;
    }

    const networkManager = interaction.client.getNetworkManager();
    const isInDb = await networkManager.fetchConnection({ channelId });
    if (!isInDb || !channelId) {
      await interaction.reply({
        content: __({ phrase: 'connection.channelNotFound', locale: interaction.user.locale }),
        ephemeral: true,
      });
      return;
    }

    // button interactions
    if (interaction.isButton() && customId.postfix === 'toggle') {
      const toggleRes = await networkManager.updateConnection(
        { channelId },
        { connected: !isInDb.connected },
      );

      await interaction.update({
        embeds: [await buildEmbed(interaction, channelId)],
        components: [
          interaction.message.components[0],
          buildConnectionButtons(toggleRes?.connected, channelId),
        ],
      });
    }

    // String select menu interactions
    else if (interaction.isStringSelectMenu()) {
      switch (interaction.values[0]) {
        case 'compact':
          await networkManager.updateConnection({ channelId }, { compact: !isInDb.compact });
          break;

        case 'profanity':
          await networkManager.updateConnection({ channelId }, { profFilter: !isInDb.profFilter });
          break;

        case 'invite': {
          const modal = new ModalBuilder()
            .setTitle('Add Invite Link')
            .setCustomId(
              new CustomID()
                .setIdentifier('connectionModal', 'invite')
                .addArgs(channelId)
                .toString(),
            )
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setLabel('Invite Link')
                  .setValue('https://discord.gg/')
                  .setCustomId(new CustomID().setIdentifier('connInviteField').toString())
                  .setRequired(false)
                  .setStyle(TextInputStyle.Short),
              ),
            );

          await interaction.showModal(modal);
          break;
        }
        case 'change_channel': {
          const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId(
                new CustomID()
                  .setIdentifier('connection', 'change_channel')
                  .addArgs(channelId)
                  .addArgs(interaction.user.id)
                  .toString(),
              )
              .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.PublicThread,
                ChannelType.PrivateThread,
              )
              .setPlaceholder('Select a channel to switch to.'),
          );

          await interaction.reply({
            content: __(
              { phrase: 'connection.switchChannel', locale: interaction.user.locale },
              { emoji: emojis.info },
            ),
            components: [channelSelect],
            ephemeral: true,
          });

          // current interaction will become outdated due to new channelId
          await interaction.message.edit({
            content: __(
              { phrase: 'connection.switchCalled', locale: interaction.user.locale },
              { emoji: emojis.info },
            ),
            components: disableComponents(interaction.message),
          });
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
                  .setValue(isInDb.embedColor || '#000000')
                  .setRequired(false),
              ),
            );

          await interaction.showModal(modal);
          break;
        }

        default:
          break;
      }

      const newEmbeds = await buildEmbed(interaction, channelId);
      interaction.replied || interaction.deferred
        ? await interaction.message.edit({ embeds: [newEmbeds] })
        : await interaction.update({ embeds: [newEmbeds] });
    }

    // channel select menu interactions
    else if (interaction.isChannelSelectMenu()) {
      if (customId.postfix !== 'change_channel') return;
      const newChannel = interaction.channels.first();

      const channelInHub = await networkManager.fetchConnection({ channelId: newChannel?.id });
      if (channelInHub) {
        await interaction.reply({
          content: __(
            { phrase: 'connection.alreadyConnected', locale: interaction.user.locale },
            { channel: `${newChannel}` },
          ),
          ephemeral: true,
        });
        return;
      }

      const newWebhook = await getOrCreateWebhook(newChannel as TextChannel | ThreadChannel);
      await networkManager.updateConnection(
        { channelId },
        { channelId: newChannel?.id, webhookURL: newWebhook?.url },
      );

      await interaction.update({
        content: __(
          { phrase: 'connection.switchSuccess', locale: interaction.user.locale },
          { channel: `${newChannel}`, emoji: emojis.yes },
        ),
        components: [],
      });
    }
  }

  @RegisterInteractionHandler('connectionModal')
  async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    if (customId.postfix === 'invite') {
      const invite = interaction.fields.getTextInputValue('connInviteField');
      const channelId = customId.args[0];
      const networkManager = interaction.client.getNetworkManager();

      if (!invite) {
        await networkManager.updateConnection({ channelId }, { invite: { unset: true } });
        await interaction.reply({
          content: __(
            { phrase: 'connection.inviteRemoved', locale: interaction.user.locale },
            { emoji: emojis.yes },
          ),
          ephemeral: true,
        });
        return;
      }

      const isValid = await interaction.client?.fetchInvite(invite).catch(() => null);

      if (isValid?.guild?.id !== interaction.guildId) {
        await interaction.reply({
          content: __({ phrase: 'connection.inviteInvalid', locale: interaction.user.locale }),
          ephemeral: true,
        });
        return;
      }

      await networkManager.updateConnection({ channelId }, { invite });

      await interaction.reply({
        content: __(
          { phrase: 'connection.inviteAdded', locale: interaction.user.locale },
          { emoji: emojis.yes },
        ),
        ephemeral: true,
      });
    }
    else if (customId.postfix === 'embed_color') {
      const embedColor = interaction.fields.getTextInputValue('embed_color');

      const hex_regex = /^#[0-9A-F]{6}$/i;
      if (embedColor && !hex_regex.test(embedColor)) {
        interaction.reply({
          content: __({ phrase: 'connection.emColorInvalid', locale: interaction.user.locale }),
          ephemeral: true,
        });
        return;
      }

      await db.connectedList.update({
        where: { channelId: customId.args[0] },
        data: { embedColor: embedColor ? embedColor : { unset: true } },
      });

      await interaction.reply({
        content: __(
          { phrase: 'connection.emColorChange', locale: interaction.user.locale },
          { action: embedColor ? `set to \`${embedColor}\`!` : 'unset', emoji: emojis.yes },
        ),
        ephemeral: true,
      });
    }

    await interaction.message
      ?.edit({ embeds: [await buildEmbed(interaction, customId.args[0])] })
      .catch(() => null);
  }
}
