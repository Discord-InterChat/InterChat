import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  RESTPostAPIApplicationCommandsJSONBody,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import Command from '../../Command.js';
import db from '../../../utils/Db.js';
import { ComponentInteraction } from '../../../decorators/Interaction.js';
import { buildEmbed } from '../../../scripts/network/buildEmbed.js';
import { buildConnectionButtons } from '../../../scripts/network/components.js';
import { emojis } from '../../../utils/Constants.js';
import { CustomID } from '../../../structures/CustomID.js';

export default class Connection extends Command {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'connection',
    description: 'Manage your connections in this server.',
    default_member_permissions: `${PermissionFlagsBits.ManageMessages}`,
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'connection',
        description: 'Choose a connection.',
        required: true,
        autocomplete: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const connection = interaction.options.getString('connection', true);
    const networkManager = interaction.client.getNetworkManager();
    const isInDb = await networkManager.fetchConnection({ channelId: connection });

    if (!isInDb) {
      interaction.reply({
        content: `${emojis.no} This connection does not exist.`,
        ephemeral: true,
      });
      return;
    }

    const embed = await buildEmbed(interaction, connection);
    const buttons = buildConnectionButtons(true, connection, { userId: interaction.user.id });

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

    const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('connection', 'settings')
            .addData(connection)
            .addData(interaction.user.id)
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

    const channelExists = await interaction.client.channels.fetch(connection).catch(() => null);

    if (!channelExists) {
      await networkManager.updateConnection(
        { channelId: connection },
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

  @ComponentInteraction('connection')
  async handleComponent(interaction: MessageComponentInteraction) {
    const customId = CustomID.toJSON(interaction.customId);
    const channelId = customId.data[0];

    if (customId.data.at(1) && customId.data[1] !== interaction.user.id) {
      interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription(
              `${emojis.no} This button is not for you. Execute the command yourself to utilize this button.`,
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
        content: `${emojis.no} This connection does not exist.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.isButton() && customId.postfix === 'toggle') {
      const toggleRes = await networkManager.updateConnection(
        { channelId },
        { connected: !isInDb.connected },
      );

      await interaction.update({
        embeds: [await buildEmbed(interaction, channelId)],
        components: [
          interaction.message.components[0],
          await buildConnectionButtons(toggleRes?.connected, channelId),
        ],
      });
    }
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
                .addData(channelId)
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
                  .addData(channelId)
                  .addData(interaction.user.id)
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
        ? await interaction.editReply({ embeds: [newEmbeds] })
        : await interaction.update({ embeds: [newEmbeds] });
    }
    else if (interaction.isChannelSelectMenu()) {
      if (customId.postfix !== 'change_channel') return;
      const newChannel = interaction.channels.first();

      if (newChannel?.id === channelId) {
        await interaction.reply({
          content: `${emojis.no} You cannot switch to the same channel.`,
          ephemeral: true,
        });
        return;
      }

      await networkManager.updateConnection({ channelId }, { channelId: newChannel?.id });

      await interaction.update(`${emojis.yes} Switched network channel to <#${newChannel?.id}>.`);
    }
  }

  @ComponentInteraction('connectionModal')
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.toJSON(interaction.customId);
    if (customId.identifier !== 'connectionModal') return;

    const invite = interaction.fields.getTextInputValue('connInviteField');
    const channelId = customId.data[0];
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
