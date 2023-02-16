import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, GuildTextBasedChannel, RestOrArray, APIEmbedField, EmbedBuilder, ChannelType, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel } from 'discord.js';
import { connect, disconnect, getServerData, updateData } from '../../Structures/network';
import { colors, getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.deferred) await interaction.deferReply();

    const emoji = interaction.client.emoji;
    const guildConnected = await getServerData({ serverId: interaction.guild?.id });

    const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId('reconnect')
        .setStyle(ButtonStyle.Success)
        .setDisabled(guildConnected ? true : false)
        .setEmoji(emoji.icons.connect),
      new ButtonBuilder()
        .setCustomId('disconnect')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!guildConnected)
        .setEmoji(emoji.icons.disconnect),
    ]);

    const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId('customize')
        .setPlaceholder('🛠️ Edit Settings')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Compact')
            .setEmoji(emoji.normal.clipart as any)
            .setDescription('Disable embeds in the network to fit more messages. Works with webhooks.')
            .setValue('compact'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Profanity Filter')
            .setEmoji('🤬' as any)
            .setDescription('Toggle swear word censoring for this server.')
            .setValue('profanity'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Webhook')
            .setEmoji(emoji.normal.webhook as any)
            .setDescription('Network messages will be sent using webhooks instead.')
            .setValue('webhook'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Invite Link')
            .setEmoji(emoji.icons.members as any)
            .setDescription('Set an invite for network users to join your server easily!')
            .setValue('invite'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Switch Channel')
            .setEmoji(emoji.icons.store as any)
            .setDescription('Set a different channel for the network.')
            .setValue('change_channel'),
        ),
    ]);


    const { setup } = getDb();
    let guildSetup = await setup.findFirst({ where: { guildId: interaction.guild?.id } });
    const setupEmbed = new SetupEmbedGenerator(interaction);

    if (!guildSetup) return interaction.followUp(`${emoji.normal.no} Server is not setup yet. Use \`/setup channel\` first.`);

    const channelExists = interaction.client.channels.cache.get(guildSetup.channelId);
    if (!channelExists) disconnect({ channelId: guildSetup.channelId });

    const setupMessage = await interaction.editReply({
      content: channelExists
        ? ''
        : `${emoji.normal.no} Automatically disconnected due to error receiving network messages. Change the channel to use the network.`,
      embeds: [await setupEmbed.default()],
      components: [customizeMenu, setupActionButtons],
    });

    const filter = (m: Interaction) => m.user.id === interaction.user.id;

    /* ------------------- Button Responce collectors ---------------------- */
    const buttonCollector = setupMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
    });

    buttonCollector.on('collect', async (component) => {
      switch (component.customId) {
        case 'reconnect': {
          const channel = await interaction.guild?.channels
            .fetch(String(guildSetup?.channelId))
            .catch(() => null) as GuildTextBasedChannel | null;

          if (!channel) {
            component.reply({ content: `${emoji.normal.no} Unable to find network channel!` });
            return;
          }

          await connect(channel);
          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);

          // disable reconnect button
          setupActionButtons.components.at(0)?.setDisabled(true);
          // enable disconnect button
          setupActionButtons.components.at(1)?.setDisabled(false);

          component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
          interaction.editReply({
            embeds: [await setupEmbed.default()],
            components: [customizeMenu, setupActionButtons],
          });
          break;
        }

        case 'disconnect':
          await disconnect({ channelId: guildSetup?.channelId });
          // enable reconnect button
          setupActionButtons.components.at(0)?.setDisabled(false);
          // disable disconnect button
          setupActionButtons.components.at(1)?.setDisabled(true);


          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);

          component.message.edit({
            embeds: [await setupEmbed.default()],
            components: [customizeMenu, setupActionButtons],
          });
          component.reply({ content: 'Disconnected!', ephemeral: true });
          break;

        default:
          break;
      }
    });

    /* ------------------- SelectMenu Responce collectors ---------------------- */

    const selectCollector = setupMessage.createMessageComponentCollector({
      filter,
      idle: 60_000 * 5,
      componentType: ComponentType.StringSelect,
    });

    selectCollector.on('collect', async (settingsMenu) => {
      guildSetup = await setup.findFirst({ where: { guildId: interaction.guild?.id } });

      switch (settingsMenu.values[0]) {
        /* Compact / Normal mode toggle  */
        case 'compact':
          await setup?.updateMany({
            where: { guildId: interaction.guild?.id },
            data: { compact: !guildSetup?.compact },
          });
          break;

        /* Profanity toggle */
        case 'profanity':
          await setup?.updateMany({
            where: { guildId: interaction.guild?.id },
            data: { profFilter: !guildSetup?.profFilter },
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
            content: 'Please select a channel. You have 20 seconds to do so.',
            components: [channelMenu],
            ephemeral: true,
          });

          const newChannelSelect = changeMsg.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            idle: 20_000,
          });
          newChannelSelect.once('collect', async (select) => {
            const oldchannel = select.guild?.channels.cache.get(`${guildSetup?.channelId}`);
            const channel = select.guild?.channels.cache.get(select?.values[0]);
            let webhook = undefined;

            if (guildSetup?.webhook) {
              // delete the old webhook
              (oldchannel as TextChannel)?.fetchWebhooks().then(promisehook => {
                promisehook.find((hook) => hook.owner?.id === hook.client.user?.id)?.delete().catch(() => null);
              }).catch(() => null);

              // create a webhook in the new channel
              webhook = await (channel as TextChannel)?.createWebhook({ name: 'ChatBot Network', avatar: select.client.user.avatarURL() });
            }

            await updateData({ channelId: guildSetup?.channelId }, { channelId: select?.values[0] });
            guildSetup = await setup.update({
              where: { channelId: guildSetup?.channelId },
              data: {
                channelId: channel?.id,
                webhook: webhook ? { set: { id: webhook.id, token: `${webhook.token}`, url: webhook.url } } : null,
              },
            });

            await select?.update({
              content: 'Channel successfully changed!',
              components: [],
            });
            interaction.editReply({ embeds: [await setupEmbed.default()] });
          });
          break;
        }

        /* Webhook Selection Response */
        case 'webhook': {
          const connectedChannel = await interaction.client.channels
            .fetch(`${guildSetup?.channelId}`)
            .catch(() => null);

          if (connectedChannel?.type !== ChannelType.GuildText) {
            await settingsMenu.reply({
              content: 'Cannot edit setup for selected channel. If you think this is a mistake report it to the developers.',
              ephemeral: true,
            });
            break;
          }

          if (guildSetup?.webhook) {
            const deleteWebhook = await connectedChannel.fetchWebhooks();
            deleteWebhook
              .find((webhook) => webhook.owner?.id === interaction.client.user.id)
              ?.delete();

            guildSetup = await setup?.update({
              where: { channelId: connectedChannel.id },
              data: { webhook: null },
            });

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
              name: 'ChatBot Network',
              avatar: interaction.client.user?.avatarURL(),
            });
          }
          catch {
            interaction.editReply('Please grant me `Manage Webhook` permissions for this to work.');
            return;
          }


          await settingsMenu.editReply(`${emoji.normal.loading} Initializing & saving webhook data...`);
          await setup?.updateMany({
            where: { guildId: interaction.guild?.id },
            data: {
              webhook: { set: { id: webhook.id, token: `${webhook.token}`, url: webhook.url } },
            },
          });
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
            .setTitle('Report')
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
                await setup.updateMany({
                  where: { guildId: i.guild?.id },
                  data: { invite: { unset: true } },
                });
                interaction.editReply({ embeds: [await setupEmbed.default()] });
                return i.reply({ content: 'Invite unset.', ephemeral: true });
              }

              const isValid = await i.client?.fetchInvite(link).catch(() => null);

              if (!isValid || isValid.guild?.id !== i.guild?.id) {
                return i.reply({
                  content: 'Invalid Invite.',
                  ephemeral: true,
                });
              }

              await setup.updateMany({
                where: { guildId: i.guild?.id },
                data: { invite: isValid.code },
              });

              i.reply({
                content: 'Invite link successfully set!',
                ephemeral: true,
              });
              interaction.editReply({ embeds: [await setupEmbed.default()] });
            }).catch((e) => {if (!e.message.includes('reason: time')) logger.error(e);});
          break;
        }
      }
      await setup.updateMany({ where: { guildId: interaction.guild?.id }, data: { date: new Date() } });

      settingsMenu.replied || settingsMenu.deferred
        ? interaction.editReply({ embeds: [await setupEmbed.default()] })
        : settingsMenu.update({ embeds: [await setupEmbed.default()] });
    });

    selectCollector.on('end', () => {
      const disabledBtns: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder(setupActionButtons);
      const disabledMenu: ActionRowBuilder<StringSelectMenuBuilder> = new ActionRowBuilder(customizeMenu);
      disabledMenu.components.forEach((menu) => menu.setDisabled(true));
      disabledBtns.components.forEach((button) => button.setDisabled(true));

      interaction.editReply({ components: [disabledMenu, disabledBtns] }).catch(() => null);
      return;
    });
  },
};

// Embed classes to make it easier to call and edit multiple embeds
class SetupEmbedGenerator {
  private interaction: ChatInputCommandInteraction;
  constructor(interaction: ChatInputCommandInteraction) {
    this.interaction = interaction;
  }
  async default() {
    const db = getDb();
    const emoji = this.interaction.client.emoji;

    const guildSetupData = await db.setup.findFirst({ where: { guildId: this.interaction?.guild?.id } });
    const guild = this.interaction.client.guilds.cache.get(`${guildSetupData?.guildId}`);
    const channel = guild?.channels.cache.get(`${guildSetupData?.channelId}`);
    const guildNetworkData = await getServerData({ channelId: channel?.id });

    // enabled/disabled emojis
    const connected = guildNetworkData ? emoji.normal.yes : emoji.normal.no;
    const profanity = guildSetupData?.profFilter ? emoji.normal.enabled : emoji.normal.disabled;
    const webhook = guildSetupData?.webhook ? emoji.normal.enabled : emoji.normal.disabled;
    const compact = guildSetupData?.compact ? emoji.normal.enabled : emoji.normal.disabled;
    const invite = guildSetupData?.invite ? `Code: [\`${guildSetupData.invite}\`](https://discord.gg/${guildSetupData.invite})` : 'Not Set.';

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
      .setThumbnail(this.interaction.guild?.iconURL() || this.interaction.client.user.avatarURL())
      .setTimestamp()
      .setFooter({ text: 'Use to menu below to edit.' });
  }
  customFields(fields: RestOrArray<APIEmbedField>) {
    return new EmbedBuilder()
      .setColor(colors('chatbot'))
      .addFields(...fields)
      .setThumbnail(this.interaction.guild?.iconURL() || null)
      .setTimestamp()
      .setAuthor({
        name: this.interaction.guild?.name as string,
        iconURL: this.interaction.guild?.iconURL()?.toString(),
      })
      .setFooter({
        text: `Requested by: ${this.interaction.user.tag}`,
        iconURL: this.interaction.user.avatarURL() ?? this.interaction.user.defaultAvatarURL,
      });
  }
}
