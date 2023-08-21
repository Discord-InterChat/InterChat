import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, GuildTextBasedChannel, EmbedBuilder, ChannelType, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel, ButtonInteraction, AnySelectMenuInteraction } from 'discord.js';
import { reconnect, disconnect } from '../../Structures/network';
import { colors, getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { captureException } from '@sentry/node';

function yesOrNo(option: unknown, yesEmoji: string, noEmoji: string) {
  return option ? yesEmoji : noEmoji;
}

function updateConnectionButtons(connected: boolean | undefined, disconnectEmoji: string, connectEmoji: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId('toggle_connection')
      .setLabel(connected ? 'Disconnect' : 'Reconnect')
      .setStyle(connected ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(connected ? disconnectEmoji : connectEmoji),
  ]);

}

// function to make it easier to edit embeds with updated data
async function setupEmbed(interaction: Interaction, channelId: string) {
  const networkData = await getDb().connectedList.findFirst({ where: { channelId }, include: { hub: true } });

  const { yes, no, enabled, disabled } = interaction.client.emotes.normal;
  const invite = networkData?.invite
    ? `Code: [\`${networkData.invite}\`](https://discord.gg/${networkData.invite})`
    : 'Not Set.';

  return new EmbedBuilder()
    .setTitle('Edit Settings')
    .setDescription(`Showing network settings for <#${channelId}>.`)
    .addFields([
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Hub', value: `${networkData?.hub?.name}`, inline: true },
      { name: 'Invite', value: invite, inline: true },
      { name: 'Connected', value: yesOrNo(networkData?.connected, yes, no), inline: true },
      { name: 'Compact', value: yesOrNo(networkData?.compact, enabled, disabled), inline: true },
      { name: 'Profanity Filter', value: yesOrNo(networkData?.profFilter, enabled, disabled), inline: true },
    ])
    .setColor(colors('chatbot'))
    .setThumbnail(interaction.guild?.iconURL() || interaction.client.user.avatarURL())
    .setTimestamp()
    .setFooter({ text: 'Use to menu below to edit.' });
}

export = {
  async execute(interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction, channelId: string, connected?: boolean) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

    const db = getDb();
    const emoji = interaction.client.emotes;

    const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId('customize')
        .setPlaceholder('🛠️ Select a setting to toggle')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Compact')
            .setEmoji(emoji.normal.clipart)
            .setDescription('Disable embeds in the network to fit more messages. Works with webhooks.')
            .setValue('compact'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Profanity Filter')
            .setEmoji('🤬')
            .setDescription('Toggle swear word censoring for this server.')
            .setValue('profanity'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Invite Link')
            .setEmoji(emoji.icons.members)
            .setDescription('Set an invite for network users to join your server easily!')
            .setValue('invite'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Switch Channel')
            .setEmoji(emoji.icons.store)
            .setDescription('Set a different channel for the network.')
            .setValue('change_channel'),
        ),
    ]);

    const channelExists = await interaction.client.channels.fetch(channelId).catch(() => null);
    const setupMessage = await interaction.editReply({
      embeds: [await setupEmbed(interaction, channelId)],
      components: [customizeMenu, updateConnectionButtons(connected, emoji.icons.disconnect, emoji.icons.connect)],
    });

    if (!channelExists) {
      await disconnect(channelId);
      await interaction.followUp({
        content: `${emoji.normal.no} Automatically disconnected from network due to errors. Change the channel to use the network.`,
        ephemeral: true,
      });
    }

    const filter = (m: Interaction) => m.user.id === interaction.user.id;

    const buttonCollector = setupMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
    });
    const selectCollector = setupMessage.createMessageComponentCollector({
      filter,
      idle: 60_000 * 5,
      componentType: ComponentType.StringSelect,
    });

    /* ------------------- Button Responce collectors ---------------------- */
    buttonCollector.on('collect', async (component) => {
      const updConnection = await db.connectedList.findFirst({ where: { channelId } });
      if (!updConnection) {
        await component.reply({
          content: `${emoji.normal.no} This network no longer exists!`,
          ephemeral: true,
        });
        return;
      }

      switch (component.customId) {
        case 'toggle_connection': {
          const channel = await interaction.guild?.channels
            .fetch(String(updConnection.channelId))
            .catch(() => null) as GuildTextBasedChannel | null;

          if (!channel) {
            component.reply({
              content: `${emoji.normal.no} Unable to find network channel!`,
              ephemeral: true,
            });
            return;
          }

          updConnection.connected ? await disconnect(updConnection.channelId) : await reconnect(channel.id);

          await component.reply({
            content: updConnection.connected
              ? `Disconnected <#${updConnection.channelId}> from the hub!`
              : `Reconnected <#${updConnection.channelId}> to the hub!`,
            ephemeral: true,
          });
          interaction.editReply({
            components: [customizeMenu, updateConnectionButtons(!updConnection.connected, emoji.icons.disconnect, emoji.icons.connect),
            ],
          });
          break;
        }

        default:
          break;
      }
      component.replied || component.deferred
        ? interaction.editReply({ embeds: [await setupEmbed(interaction, updConnection.channelId)] })
        : component.update({ embeds: [await setupEmbed(interaction, updConnection.channelId)] });

    });

    /* ------------------- SelectMenu Responce collectors ---------------------- */
    selectCollector.on('collect', async (settingsMenu) => {
      const updConnection = await db.connectedList.findFirst({ where: { channelId } });
      if (!updConnection) {
        await settingsMenu.reply({
          content: `${emoji.normal.no} This network no longer exists!`,
          ephemeral: true,
        });
        return;
      }

      switch (settingsMenu.values[0]) {
        /* Compact / Normal mode toggle  */
        case 'compact':{
          await db.connectedList.update({
            where: { channelId: updConnection.channelId },
            data: { compact: !updConnection.compact },
          });
          break;
        }
        /* Profanity toggle */
        case 'profanity':
          await db.connectedList.update({
            where: { channelId: updConnection.channelId },
            data: { profFilter: !updConnection.profFilter },
          });
          break;

        /* Change channel request Response */
        case 'change_channel': {
          const channelMenu = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('newChannelSelect')
                .setPlaceholder('Select new channel')
                .addChannelTypes(ChannelType.GuildText),
            );

          const changeMsg = await settingsMenu.reply({
            content: 'Please select a channel within the next 20 seconds.',
            components: [channelMenu],
            ephemeral: true,
          });

          const selected = await changeMsg.awaitMessageComponent({
            componentType: ComponentType.ChannelSelect,
            idle: 20_000,
          }).catch(() => null);

          if (!selected) return;

          const oldchannel = selected.guild?.channels.cache.get(`${updConnection?.channelId}`) as TextChannel;
          const channel = selected.guild?.channels.cache.get(selected?.values[0]) as TextChannel;

          if (await db.connectedList.findFirst({ where: { channelId: channel.id } })) {
            await selected.update({
              content: `${emoji.normal.no} Channel ${channel} is already connected to a hub. Please leave that hub first or select another channel.`,
              components: [],
            });
            return;
          }

          // delete the old webhook
          oldchannel?.fetchWebhooks()
            .then(promisehook => promisehook.find((hook) => hook.owner?.id === hook.client.user?.id)?.delete().catch(() => null))
            .catch(() => null);

          // create a webhook in the new channel
          const webhook = await channel?.createWebhook({
            name: 'InterChat Network',
            avatar: selected.client.user.avatarURL(),
          });

          await db.connectedList.update({
            where: { channelId: updConnection.channelId },
            data: {
              channelId: channel?.id,
              webhookURL: webhook.url,
            },
          });

          await selected?.update({
            content: `Successfully switched connection from ${oldchannel} to ${channel}!`,
            components: [],
          });
          break;
        }

        /* Invite Selection Response */
        case 'invite': {
          await interaction.followUp({
            content: 'Setting an invite allows users to join your server through the `Server Info` context menu. Servers that go against our </rules:924659340898619395> will be removed.',
            ephemeral: true,
          });

          const modal = new ModalBuilder()
            .setCustomId(settingsMenu.id)
            .setTitle('Set Invite')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('invite_link')
                  .setStyle(TextInputStyle.Short)
                  .setLabel('Invite Link')
                  .setPlaceholder('Provide a invite link or code. Leave blank to remove.')
                  .setValue('https://discord.gg/')
                  .setMaxLength(35)
                  .setRequired(false),
              ),
            );

          await settingsMenu.showModal(modal);

          const modalResp = await settingsMenu.awaitModalSubmit({ time: 60_000 }).catch((e) => {
            if (!e.message.includes('reason: time')) {
              logger.error(e);
              captureException(e);
            }
            return null;
          });

          if (!modalResp) return;

          const link = modalResp.fields.getTextInputValue('invite_link');

          if (!link) {
            await db.connectedList.update({
              where: { channelId },
              data: { invite: { unset: true } },
            });
            modalResp.reply({ content: 'Invite unset.', ephemeral: true });
            return;
          }

          const isValid = await modalResp.client?.fetchInvite(link).catch(() => null);

          if (!isValid || isValid.guild?.id !== modalResp.guild?.id) {
            modalResp.reply({
              content: 'Invalid Invite.',
              ephemeral: true,
            });
            return;
          }

          await db.connectedList.update({ where: { channelId: updConnection.channelId }, data: { invite: isValid.code } });

          modalResp.reply({
            content: 'Invite link successfully set!',
            ephemeral: true,
          });
          break;
        }
      }

      settingsMenu.replied || settingsMenu.deferred
        ? interaction.editReply({ embeds: [await setupEmbed(interaction, updConnection.channelId)] })
        : settingsMenu.update({ embeds: [await setupEmbed(interaction, updConnection.channelId)] });
    });

    selectCollector.on('end', () => {
      buttonCollector.stop('Components disabled.');
      interaction.editReply({ components: [] }).catch(() => null);
      return;
    });
  },
};
