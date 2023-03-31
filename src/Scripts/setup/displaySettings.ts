import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, GuildTextBasedChannel, EmbedBuilder, ChannelType, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel } from 'discord.js';
import { reconnect, disconnect, getConnection, updateConnection } from '../../Structures/network';
import { colors } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

// function to make it easier to edit embeds with updated data
async function setupEmbed(interaction: ChatInputCommandInteraction) {
  const emoji = interaction.client.emotes;

  const guildNetworkData = await getConnection({ serverId: interaction.guild?.id });
  const channel = interaction.guild?.channels.cache.get(`${guildNetworkData?.channelId}`);

  // enabled/disabled emojis
  const connected = guildNetworkData ? emoji.normal.yes : emoji.normal.no;
  const profanity = guildNetworkData?.profFilter ? emoji.normal.enabled : emoji.normal.disabled;
  const webhook = guildNetworkData?.webhook ? emoji.normal.enabled : emoji.normal.disabled;
  const compact = guildNetworkData?.compact ? emoji.normal.enabled : emoji.normal.disabled;
  const invite = guildNetworkData?.invite
    ? `Code: [\`${guildNetworkData.invite}\`](https://discord.gg/${guildNetworkData.invite})`
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
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.deferred) await interaction.deferReply();

    const emoji = interaction.client.emotes;
    let guildConnected = await getConnection({ serverId: interaction.guild?.id });
    if (!guildConnected) return interaction.followUp(`${emoji.normal.no} No network has been setup in this server. Use \`/setup channel\` first.`);

    const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId('reconnect')
        .setStyle(ButtonStyle.Success)
        .setDisabled(guildConnected.connected)
        .setEmoji(emoji.icons.connect),
      new ButtonBuilder()
        .setCustomId('disconnect')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!guildConnected.connected)
        .setEmoji(emoji.icons.disconnect),
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


    const channelExists = interaction.client.channels.cache.get(guildConnected.channelId);
    if (!channelExists) disconnect(guildConnected.channelId);

    const setupMessage = await interaction.editReply({
      content: channelExists
        ? ''
        : `${emoji.normal.no} Automatically disconnected due to error receiving network messages. Change the channel to use the network.`,
      embeds: [await setupEmbed(interaction)],
      components: [customizeMenu, setupActionButtons],
    });

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
      switch (component.customId) {
        case 'reconnect': {
          const channel = await interaction.guild?.channels
            .fetch(String(guildConnected?.channelId))
            .catch(() => null) as GuildTextBasedChannel | null;

          if (!channel) {
            component.reply({ content: `${emoji.normal.no} Unable to find network channel!` });
            return;
          }

          await reconnect(channel.id);
          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);

          // disable reconnect button
          setupActionButtons.components.at(0)?.setDisabled(true);
          // enable disconnect button
          setupActionButtons.components.at(1)?.setDisabled(false);

          component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
          interaction.editReply({
            embeds: [await setupEmbed(interaction)],
            components: [customizeMenu, setupActionButtons],
          });
          break;
        }

        case 'disconnect':
          if (!guildConnected) {
            component.reply({
              content: `${emoji.normal.no} This server is not connected to the network!`,
              ephemeral: true,
            });
            return;
          }

          await disconnect(guildConnected.channelId);
          // enable reconnect button
          setupActionButtons.components.at(0)?.setDisabled(false);
          // disable disconnect button
          setupActionButtons.components.at(1)?.setDisabled(true);


          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);

          component.message.edit({
            embeds: [await setupEmbed(interaction)],
            components: [customizeMenu, setupActionButtons],
          });
          component.reply({ content: 'Disconnected!', ephemeral: true });
          break;

        default:
          break;
      }
    });

    /* ------------------- SelectMenu Responce collectors ---------------------- */
    selectCollector.on('collect', async (settingsMenu) => {
      guildConnected = await getConnection({ serverId: interaction.guild?.id });

      switch (settingsMenu.values[0]) {
        /* Compact / Normal mode toggle  */
        case 'compact':
          await updateConnection({ serverId: interaction.guild?.id }, { compact: !guildConnected?.compact });
          break;

        /* Profanity toggle */
        case 'profanity':
          await updateConnection({ serverId: interaction.guild?.id }, { profFilter: !guildConnected?.profFilter });
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

          const newChannelSelect = changeMsg.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            idle: 20_000,
          });
          newChannelSelect.once('collect', async (select) => {
            const oldchannel = select.guild?.channels.cache.get(`${guildConnected?.channelId}`);
            const channel = select.guild?.channels.cache.get(select?.values[0]);
            let webhook = undefined;

            if (guildConnected?.webhook) {
              // delete the old webhook
              (oldchannel as TextChannel)?.fetchWebhooks().then(promisehook => {
                promisehook.find((hook) => hook.owner?.id === hook.client.user?.id)?.delete().catch(() => null);
              }).catch(() => null);

              // create a webhook in the new channel
              webhook = await (channel as TextChannel)
                ?.createWebhook({ name: 'InterChat Network', avatar: select.client.user.avatarURL() });
            }

            await updateConnection({ channelId: guildConnected?.channelId }, { channelId: select?.values[0] });

            guildConnected = await updateConnection(
              { channelId: guildConnected?.channelId },
              {
                channelId: channel?.id,
                webhook: webhook ? { id: webhook.id, token: `${webhook.token}`, url: webhook.url } : null,
              },
            );

            await select?.update({
              content: 'Channel successfully changed!',
              components: [],
            });
            interaction.editReply({ embeds: [await setupEmbed(interaction)] });
          });
          break;
        }

        /* Webhook Selection Response */
        case 'webhook': {
          const connectedChannel = await interaction.client.channels
            .fetch(`${guildConnected?.channelId}`)
            .catch(() => null);

          if (connectedChannel?.type !== ChannelType.GuildText) {
            await settingsMenu.reply({
              content: 'Cannot edit setup for selected channel. If you think this is a mistake report it to the developers.',
              ephemeral: true,
            });
            break;
          }

          if (guildConnected?.webhook) {
            const deleteWebhook = await connectedChannel.fetchWebhooks();
            deleteWebhook
              .find((webhook) => webhook.owner?.id === interaction.client.user.id)
              ?.delete();

            guildConnected = await updateConnection({ channelId: connectedChannel.id }, { webhook: null });

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
            { serverId: interaction.guild?.id },
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

          settingsMenu.awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === modal.data.custom_id })
            .then(async (i) => {
              const link = i.fields.getTextInputValue('invite_link');

              if (!link) {
                await updateConnection({ serverId: i.guild?.id }, { invite: { unset: true } });
                interaction.editReply({ embeds: [await setupEmbed(interaction)] });
                return i.reply({ content: 'Invite unset.', ephemeral: true });
              }

              const isValid = await i.client?.fetchInvite(link).catch(() => null);

              if (!isValid || isValid.guild?.id !== i.guild?.id) {
                return i.reply({
                  content: 'Invalid Invite.',
                  ephemeral: true,
                });
              }

              await updateConnection({ serverId: i.guild?.id }, { invite: isValid.code });

              i.reply({
                content: 'Invite link successfully set!',
                ephemeral: true,
              });
              interaction.editReply({ embeds: [await setupEmbed(interaction)] });
            }).catch((e) => {if (!e.message.includes('reason: time')) logger.error(e);});
          break;
        }
      }

      settingsMenu.replied || settingsMenu.deferred
        ? interaction.editReply({ embeds: [await setupEmbed(interaction)] })
        : settingsMenu.update({ embeds: [await setupEmbed(interaction)] });
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
