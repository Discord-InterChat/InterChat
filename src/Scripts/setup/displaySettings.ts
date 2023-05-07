import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, GuildTextBasedChannel, EmbedBuilder, ChannelType, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel } from 'discord.js';
import { reconnect, disconnect, getConnection, updateConnection } from '../../Structures/network';
import { colors } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { captureException } from '@sentry/node';

// function to make it easier to edit embeds with updated data
async function setupEmbed(interaction: ChatInputCommandInteraction, channelId: string) {
  const emoji = interaction.client.emotes;

  const networkData = await getConnection({ channelId });
  const channel = interaction.guild?.channels.cache.get(`${networkData?.channelId}`);

  // enabled/disabled emojis
  const connected = networkData?.connected ? emoji.normal.yes : emoji.normal.no;
  const profanity = networkData?.profFilter ? emoji.normal.enabled : emoji.normal.disabled;
  const webhook = networkData?.webhook ? emoji.normal.enabled : emoji.normal.disabled;
  const compact = networkData?.compact ? emoji.normal.enabled : emoji.normal.disabled;
  const invite = networkData?.invite
    ? `Code: [\`${networkData.invite}\`](https://discord.gg/${networkData.invite})`
    : 'Not Set.';

  return new EmbedBuilder()
    .setTitle('Edit Settings')
    .setDescription(`Showing network settings for ${channel || 'None'}.`)
    .addFields([
      { name: 'Channel', value: `${channel || `${emoji.normal.no} Error.`}`, inline: true },
      { name: 'Connected', value: connected, inline: true },
      { name: 'Invite', value: invite, inline: true },
      { name: 'Compact', value: compact, inline: true },
      { name: 'Profanity Filter', value: profanity, inline: true },
      { name: 'Webhook', value: webhook, inline: true },
    ])
    .setColor(colors('chatbot'))
    .setThumbnail(interaction.guild?.iconURL() || interaction.client.user.avatarURL())
    .setTimestamp()
    .setFooter({ text: 'Use to menu below to edit.' });
}

export = {
  async execute(interaction: ChatInputCommandInteraction, channelId: string) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

    const emoji = interaction.client.emotes;
    const connection = await getConnection({ channelId });
    if (!connection) return await interaction.editReply(`${emoji.normal.no} Invalid network connection provided.`);

    const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(connection.connected ? 'disconnect' : 'reconnect')
        .setLabel(connection.connected ? 'Disconnect' : 'Reconnect')
        .setStyle(connection.connected ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(connection.connected ? emoji.icons.disconnect : emoji.icons.connect),
    ]);

    const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId('customize')
        .setPlaceholder('🛠️ Edit Settings')
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
            .setLabel('Webhook')
            .setEmoji(emoji.normal.webhook)
            .setDescription('Network messages will be sent using webhooks instead.')
            .setValue('webhook'),
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


    const channelExists = await interaction.client.channels.fetch(connection.channelId).catch(() => null);
    const setupMessage = await interaction.editReply({
      embeds: [await setupEmbed(interaction, channelId)],
      components: [customizeMenu, setupActionButtons],
    });

    if (!channelExists) {
      await disconnect(connection.channelId);
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
      const updConnection = await getConnection({ channelId });
      if (!updConnection) {
        await component.reply({
          content: `${emoji.normal.no} This network no longer exists!`,
          ephemeral: true,
        });
        return;
      }

      switch (component.customId) {
        case 'reconnect': {
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

          await reconnect(channel.id);
          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);

          setupActionButtons.components.at(0)
            ?.setCustomId('disconnect')
            .setLabel('Disconnect')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emoji.icons.disconnect);

          await component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
          component.message.edit({
            components: [customizeMenu, setupActionButtons],
          });
          break;
        }

        case 'disconnect':
          await disconnect(updConnection.channelId);
          setupActionButtons.components.at(0)
            ?.setCustomId('reconnect')
            .setLabel('Reconnect')
            .setStyle(ButtonStyle.Success)
            .setEmoji(emoji.icons.connect);


          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);

          await component.reply({ content: 'Disconnected!', ephemeral: true });
          component.message.edit({
            components: [customizeMenu, setupActionButtons],
          });
          break;

        default:
          break;
      }
      component.replied || component.deferred
        ? component.message.edit({ embeds: [await setupEmbed(interaction, channelId)] })
        : component.update({ embeds: [await setupEmbed(interaction, channelId)] });

    });

    /* ------------------- SelectMenu Responce collectors ---------------------- */
    selectCollector.on('collect', async (settingsMenu) => {
      const updConnection = await getConnection({ channelId: connection.channelId });
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
          await updateConnection({ channelId: updConnection.channelId }, { compact: !updConnection.compact });
          break;
        }
        /* Profanity toggle */
        case 'profanity':
          await updateConnection({ channelId: updConnection.channelId }, { profFilter: !updConnection.profFilter });
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
            content: 'Please select a channel. You have 20 seconds to do so.',
            components: [channelMenu],
            ephemeral: true,
          });

          const selected = await changeMsg.awaitMessageComponent({
            componentType: ComponentType.ChannelSelect,
            idle: 20_000,
          });


          const oldchannel = selected.guild?.channels.cache.get(`${updConnection?.channelId}`) as TextChannel;
          const channel = selected.guild?.channels.cache.get(selected?.values[0]) as TextChannel;
          let webhook = undefined;

          if (await getConnection({ channelId: channel.id })) {
            await selected.reply({
              content: `The channel ${channel} is already connected to a hub. Choose another channel.`,
              ephemeral: true,
            });
            return;
          }
          channelId = channel.id;

          if (updConnection?.webhook) {
            // delete the old webhook
            oldchannel?.fetchWebhooks()
              .then(promisehook => promisehook.find((hook) => hook.owner?.id === hook.client.user?.id)?.delete().catch(() => null))
              .catch(() => null);

            // create a webhook in the new channel
            webhook = await channel?.createWebhook({
              name: 'InterChat Network',
              avatar: selected.client.user.avatarURL(),
            });
          }

          await updateConnection({ channelId: updConnection.channelId }, { channelId: selected?.values[0] });

          await updateConnection(
            { channelId: updConnection.channelId },
            {
              channelId: channel?.id,
              webhook: webhook ? { id: webhook.id, token: `${webhook.token}`, url: webhook.url } : null,
            },
          );


          await selected?.update({
            content: 'Channel successfully changed!',
            components: [],
          });
          break;
        }

        /* Webhook Selection Response */
        case 'webhook': {
          const connectedChannel = await interaction.client.channels
            .fetch(`${updConnection.channelId}`)
            .catch(() => null);

          if (connectedChannel?.type !== ChannelType.GuildText) {
            await settingsMenu.reply({
              content: 'Cannot edit setup for selected channel. If you think this is a mistake report it to the developers.',
              ephemeral: true,
            });
            return;
          }

          if (updConnection.webhook) {
            const deleteWebhook = await connectedChannel.fetchWebhooks();
            deleteWebhook
              .find((webhook) => webhook.owner?.id === interaction.client.user.id)
              ?.delete();

            await updateConnection({ channelId: connectedChannel.id }, { webhook: null });

            await settingsMenu.reply({
              content: 'Webhook messages have been disabled.',
              ephemeral: true,
            });
            break;
          }

          await settingsMenu.reply({
            content: `${emoji.normal.loading} Creating webhook...`,
            ephemeral: true,
          });

          let webhook;
          try {
            webhook = await connectedChannel.createWebhook({
              name: 'InterChat Network',
              avatar: interaction.client.user?.avatarURL(),
            });
          }
          catch (e: any) {
            if (e.message.includes('Missing Permissions')) settingsMenu.editReply(emoji.normal.no + ' Please grant me `Manage Webhook` permissions for this to work.');
            else settingsMenu.editReply(`${emoji.normal.no} **Error during webhook creation**: ${e.message}`);
            break;
          }


          await settingsMenu.editReply(`${emoji.normal.loading} Initializing & saving webhook data...`);
          await updateConnection(
            { channelId },
            { webhook: { id: webhook.id, token: `${webhook.token}`, url: webhook.url } },
          );
          await settingsMenu.editReply(`${emoji.normal.yes} Webhooks have been enabled!`);
          break;
        }

        /* Invite Selection Response */
        case 'invite': {
          await interaction.followUp({
            content: 'Setting an invite allows users throughout the network view and join your server. At the moment visible only though the `Server Info` context menu, but will be available in other coming features. Servers that go against our </rules:924659340898619395> will be removed and blacklisted.',
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
            await updateConnection({ channelId }, { invite: { unset: true } });
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

          await updateConnection({ channelId }, { invite: isValid.code });

          modalResp.reply({
            content: 'Invite link successfully set!',
            ephemeral: true,
          });
          break;
        }
      }

      settingsMenu.replied || settingsMenu.deferred
        ? interaction.editReply({ embeds: [await setupEmbed(interaction, channelId)] })
        : settingsMenu.update({ embeds: [await setupEmbed(interaction, channelId)] });
    });

    selectCollector.on('end', () => {
      const disabledBtns: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder(setupActionButtons);
      const disabledMenu: ActionRowBuilder<StringSelectMenuBuilder> = new ActionRowBuilder(customizeMenu);
      disabledMenu.components.forEach((menu) => menu.setDisabled(true));
      disabledBtns.components.forEach((button) => button.setDisabled(true));
      buttonCollector.stop('Components disabled.');

      interaction.editReply({ components: [disabledMenu, disabledBtns] }).catch(() => null);
      return;
    });
  },
};
