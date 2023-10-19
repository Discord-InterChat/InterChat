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
import { Interaction } from '../../../decorators/Interaction.js';
import { buildEmbed } from '../../../scripts/network/buildEmbed.js';
import { buildConnectionButtons } from '../../../scripts/network/components.js';
import { emojis } from '../../../utils/Constants.js';
import { CustomID } from '../../../structures/CustomID.js';
import { disableComponents, errorEmbed, getOrCreateWebhook } from '../../../utils/Utils.js';

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
    const channelId = interaction.options.getString('channel', true);
    const isInDb = await networkManager.fetchConnection({ channelId });

    if (!isInDb) {
      interaction.reply({
        content: `${emojis.no} This connection does not exist.`,
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
        content: `${emojis.no} Automatically disconnected from network due to errors. Change the channel to use the network.`,
        ephemeral: true,
      });
    }

    await interaction.editReply({
      embeds: [embed],
      components: [customizeMenu, buttons],
    });

    // TODO Button expiration
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

  @Interaction('connection')
  async handleComponents(interaction: MessageComponentInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args[0];

    if (customId.args.at(1) && customId.args[1] !== interaction.user.id) {
      interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.no} This button is not for you. Execute the command yourself to use this button.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const networkManager = interaction.client.getNetworkManager();
    const isInDb = await networkManager.fetchConnection({ channelId });
    if (!isInDb || !channelId) {
      await interaction.reply({
        content: `${emojis.no} This connection no longer exists.`,
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
            content: `${emojis.info} Select a channel to switch to using the select menu below:`,
            components: [channelSelect],
            ephemeral: true,
          });

          // current interaction will become outdated due to new channelId
          await interaction.message.edit({
            content: `${emojis.info} Channel switch called, use the command again to view new connection.`,
            components: disableComponents(interaction.message),
          });
          break;
        }

        case 'embed_color': {
          // TODO
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
          content: `${emojis.no} Channel ${newChannel} is already connected to a hub.`,
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
        content: `${emojis.yes} Switched network channel to <#${newChannel?.id}>.`,
        components: [],
      });
    }
  }

  @Interaction('connectionModal')
  async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    if (customId.prefix !== 'connectionModal') return;

    const invite = interaction.fields.getTextInputValue('connInviteField');
    const channelId = customId.args[0];
    const networkManager = interaction.client.getNetworkManager();

    if (!invite) {
      await networkManager.updateConnection({ channelId }, { invite: { unset: true } });
      await interaction.reply({ content: `${emojis.yes} Invite Removed.`, ephemeral: true });
      return;
    }

    const isValid = await interaction.client?.fetchInvite(invite).catch(() => null);

    if (isValid?.guild?.id !== interaction.guildId) {
      await interaction.reply({ content: `${emojis.no} Invalid Invite.`, ephemeral: true });
      return;
    }

    await networkManager.updateConnection({ channelId }, { invite });

    await interaction.reply({
      content: `${emojis.yes} Invite Added. Others can now join the server by using \`Message Info\` Apps command in the network.`,
      ephemeral: true,
    });
  }
}
