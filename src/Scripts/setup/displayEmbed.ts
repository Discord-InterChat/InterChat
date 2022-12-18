import { PrismaClient } from '@prisma/client';
import { stripIndent } from 'common-tags';
import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, GuildTextBasedChannel, RestOrArray, APIEmbedField, EmbedBuilder, ChannelType, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { NetworkManager } from '../../Structures/network';
import { colors, getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
  async execute(interaction: ChatInputCommandInteraction, db: PrismaClient) {
    if (!interaction.deferred) await interaction.deferReply();

    const emoji = interaction.client.emoji;
    const setupCollection = db.setup;

    const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId('reconnect')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emoji.icons.connect),
      new ButtonBuilder()
        .setCustomId('disconnect')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emoji.icons.disconnect),
    ]);

    const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId('customize')
        .setPlaceholder('🛠️ Edit Settings')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Compact Mode')
            .setEmoji(emoji.normal.clipart as any)
            .setDescription('Disable embeds in the network to fit more messages.')
            .setValue('compact'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Profanity Filter')
            .setEmoji('🤬' as any)
            .setDescription('Toggle swear word censoring for this server.')
            .setValue('profanity'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Webhooks')
            .setEmoji(emoji.normal.webhook as any)
            .setDescription('Network messages will be sent using webhooks instead.')
            .setValue('webhook'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Set Invite')
            .setEmoji(emoji.icons.members as any)
            .setDescription('Set a server invite so people can join your server!')
            .setValue('invite'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Change Channel')
            .setEmoji(emoji.icons.store as any)
            .setDescription('Set a different channel for the network.')
            .setValue('change_channel'),
        ),
    ]);


    const network = new NetworkManager();
    const setupEmbed = new SetupEmbedGenerator(interaction);

    let guildSetup = await setupCollection.findFirst({ where: { guildId: interaction.guild?.id } });
    const guildConnected = await network.getServerData({ serverId: interaction.guild?.id });

    if (!guildSetup) return interaction.followUp(`${emoji.normal.no} Server is not setup yet. Use \`/setup channel\` first.`);
    if (!interaction.guild?.channels.cache.get(guildSetup?.channelId)) {
      await setupCollection.delete({ where: { channelId: guildSetup?.channelId } });
      return await interaction.followUp(`${emoji.normal.no} Network channel not found. Use \`/setup channel\` to set a new one.`);
    }

    if (!guildConnected) setupActionButtons.components.at(-1)?.setDisabled(true);

    const setupMessage = await interaction.editReply({
      content: '',
      embeds: [await setupEmbed.default()],
      components: [customizeMenu, setupActionButtons],
    });

    const filter = (m: Interaction) => m.user.id === interaction.user.id;
    const buttonCollector = setupMessage.createMessageComponentCollector({
      filter,
      time: 60_000,
      componentType: ComponentType.Button,
    });

    const selectCollector = setupMessage.createMessageComponentCollector({
      filter,
      idle: 60_000,
      componentType: ComponentType.StringSelect,
    });

    selectCollector.on('collect', async (settingsMenu) => {
      guildSetup = await setupCollection.findFirst({ where: { guildId: interaction.guild?.id } });

      switch (settingsMenu.values[0]) {
        case 'compact':
          await setupCollection?.updateMany({
            where: { guildId: interaction.guild?.id },
            data: { date: new Date(), compact: !guildSetup?.compact },
          });
          break;

        case 'profanity':
          await setupCollection?.updateMany({
            where: { guildId: interaction.guild?.id },
            data: { date: new Date(), profFilter: !guildSetup?.profFilter },
          });
          break;

        case 'webhook': {
          const connectedChannel = await interaction.client.channels
            .fetch(`${guildSetup?.channelId}`)
            .catch(() => null);

          if (connectedChannel?.type !== ChannelType.GuildText) {
            await settingsMenu.reply({
              content: 'Cannot edit setup for selected channel. If you think this is a mistake report this to the developers.',
              ephemeral: true,
            });
            break;
          }

          if (guildSetup?.webhook) {
            const deleteWebhook = await connectedChannel.fetchWebhooks();
            deleteWebhook
              .find((webhook) => webhook.owner?.id === interaction.client.user.id)
              ?.delete();

            guildSetup = await setupCollection?.update({
              where: { channelId: connectedChannel.id },
              data: { date: new Date(), webhook: null },
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

          const webhook = await connectedChannel.createWebhook({
            name: 'ChatBot Network',
            avatar: interaction.client.user?.avatarURL(),
          });


          await settingsMenu.editReply(`${emoji.normal.loading} Initializing & saving webhook data...`);
          await setupCollection?.updateMany({
            where: { guildId: interaction.guild?.id },
            data: {
              date: new Date(),
              webhook: { set: { id: webhook.id, token: `${webhook.token}`, url: webhook.url } },
            },
          });
          await settingsMenu.editReply(`${emoji.normal.yes} Webhooks have been successfully setup!`);
          break;
        }
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

          // respond to message when Modal is submitted
          settingsMenu.awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === modal.data.custom_id })
            .then(async (i) => {
              const link = i.fields.getTextInputValue('invite_link');

              if (!link) {
                await setupCollection.updateMany({
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

              await setupCollection.updateMany({
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
          newChannelSelect.once('collect', async (SelectInteraction) => {
            await network.updateData({ channelId: guildSetup?.channelId }, { channelId: SelectInteraction?.values[0] });
            guildSetup = await setupCollection.update({
              where: { channelId: guildSetup?.channelId },
              data: { channelId: SelectInteraction?.values[0] },
            });

            await SelectInteraction?.update({
              content: 'Channel successfully set!',
              components: [],
            });
            interaction.editReply({ embeds: [await setupEmbed.default()] });
          });
          break;
        }
      }
      settingsMenu.replied || settingsMenu.deferred
        ? interaction.editReply({ embeds: [await setupEmbed.default()] })
        : settingsMenu.update({ embeds: [await setupEmbed.default()] });
    });

    buttonCollector.on('collect', async (component) => {
      switch (component.customId) {
        case 'reconnect': {
          const channel = await interaction.guild?.channels
            .fetch(String(guildSetup?.channelId))
            .catch(() => null) as GuildTextBasedChannel | null;

          if (guildConnected) {
            network.disconnect(interaction.guildId);
            logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);
          }

          await network.connect(interaction.guild, channel);
          logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);

          setupActionButtons.components.at(-1)?.setDisabled(false);

          component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
          interaction.editReply({
            embeds: [await setupEmbed.default()],
            components: [customizeMenu, setupActionButtons],
          });
          break;
        }

        case 'disconnect':
          await network.disconnect({ channelId: guildSetup?.channelId });
          setupActionButtons.components.at(-1)?.setDisabled(true);

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
    const guildNetworkData = await new NetworkManager().getServerData({ channelId: channel?.id });

    // option enabled/disabled emojis
    const invite = guildSetupData?.invite ? `[\`${guildSetupData.invite}\`](https://discord.gg/${guildSetupData.invite})` : 'Not Set.';
    const status = channel && guildNetworkData ? emoji.normal.yes : emoji.normal.no;
    const compact = guildSetupData?.compact ? emoji.normal.enabled : emoji.normal.disabled;
    const profanity = guildSetupData?.profFilter ? emoji.normal.enabled : emoji.normal.disabled;
    const webhook = guildSetupData?.webhook ? emoji.normal.enabled : emoji.normal.disabled;
    const lastEditedTimestamp = Math.round(Number(guildSetupData?.date.getTime()) / 1000);


    return new EmbedBuilder()
      .setTitle(`${this.interaction.guild?.name}`)
      .addFields(
        {
          name: 'Network State',
          value: stripIndent`
	  **Connected:** ${status}
	  **Channel:** ${channel}
	  **Last Edited:** <t:${lastEditedTimestamp}:R>
	  `,
          inline: true,
        },
        {
          name: 'Style',
          value: stripIndent`
          **Compact:** ${compact}
	  **Profanity Filter:** ${profanity}
          **Webhook Messages:**  ${webhook}
	`,
          inline: true,
        },
        {
          name: 'Other',
          value: `**Invite:** ${invite}`,
        },
      )
      .setColor(colors('chatbot'))
      .setThumbnail(this.interaction.guild?.iconURL() || null)
      .setTimestamp()
      .setFooter({
        text: `Requested by ${this.interaction.user.tag}`,
        iconURL: this.interaction.user.avatarURL() ?? this.interaction.user.defaultAvatarURL,
      });
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
