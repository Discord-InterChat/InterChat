import db from '../../../../utils/Db.js';
import Hub from './index.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { t } from '../../../../utils/Locale.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { stripIndents } from 'common-tags';
import { colors, emojis } from '../../../../utils/Constants.js';
import { Prisma } from '@prisma/client';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { buildSettingsEmbed, buildSettingsMenu } from '../../../../scripts/hub/settings.js';
import { HubSettingsBitField, HubSettingsString } from '../../../../utils/BitFields.js';
import { checkAndFetchImgurUrl, simpleEmbed, setComponentExpiry } from '../../../../utils/Utils.js';
import { actionsSelect, hubEmbed } from '../../../../scripts/hub/manage.js';
import { genLogInfoEmbed } from '../../../../scripts/hub/logs.js';

export default class Manage extends Hub {
  async execute(interaction: ChatInputCommandInteraction) {
    // the chosen one heh
    const chosenHub = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({
      where: {
        name: chosenHub,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound_mod', locale: interaction.user.locale }))],
      });
      return;
    }

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Settings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.settings)
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_manage', 'settingsBtn')
            .addArgs(interaction.user.id)
            .addArgs(hubInDb.name)
            .toString(),
        ),
      new ButtonBuilder()
        .setLabel('Logging')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.store)
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_manage', 'logsBtn')
            .addArgs(interaction.user.id)
            .addArgs(hubInDb.name)
            .toString(),
        ),
    );

    await interaction.reply({
      embeds: [await hubEmbed(hubInDb)],
      components: [
        actionsSelect(hubInDb.name, interaction.user.id, interaction.user.locale),
        button,
      ],
    });

    // disable components after 5 minutes
    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 5000,
    );
  }

  @RegisterInteractionHandler('hub_manage')
  async handleComponents(interaction: MessageComponentInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const locale = interaction.user.locale;

    if (customId.args[0] !== interaction.user.id) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.notYourAction', locale }))],
        ephemeral: true,
      });
      return;
    }

    const hubInDb = await db.hubs.findFirst({
      where: { name: customId.args[1] },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }))],
        ephemeral: true,
      });
      return;
    }

    // settings button
    if (interaction.isButton()) {
      if (customId.postfix === 'settingsBtn') {
        const { name, iconUrl, settings } = hubInDb;
        const embed = buildSettingsEmbed(name, iconUrl, settings);
        const selects = buildSettingsMenu(settings, name, customId.args[0]);

        await interaction.reply({ embeds: [embed], components: [selects], ephemeral: true });
      }
      else if (customId.postfix === 'logsBtn') {
        const embed = genLogInfoEmbed(hubInDb);

        const selects = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsSelect')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.name)
                .toString(),
            )
            .setPlaceholder('Choose a log type to set a channel.')
            .addOptions([
              {
                label: 'Profanity',
                value: 'profanity',
                description: 'Log messages that contain profanity.',
                emoji: '🤬',
              },
              {
                label: 'Mod Logs',
                value: 'modLogs',
                description: 'Log moderation actions taken by hub moderators.',
                emoji: '👮',
              },
              {
                label: 'Reports',
                value: 'reports',
                description: 'Log reports sent by users.',
                emoji: '📢',
              },
              {
                label: 'Message Edits',
                value: 'msgEdits',
                description: 'Log message edits.',
                emoji: '📝',
              },
              {
                label: 'Message Deletes',
                value: 'msgDeletes',
                description: 'Log message deletes.',
                emoji: '🗑️',
              },
              {
                label: 'Joins/Leaves',
                value: 'joinLeaves',
                description: 'Log when a server joins/leaves the hub.',
                emoji: '👋',
              },
            ]),
        );
        await interaction.reply({ embeds: [embed], components: [selects], ephemeral: true });
      }
    }

    // hub manage selects/toggle settings menu
    else if (interaction.isStringSelectMenu()) {
      if (customId.postfix === 'actions') {
        switch (interaction.values[0]) {
          case 'icon': {
            const modal = new ModalBuilder()
              .setCustomId(
                new CustomID()
                  .setIdentifier('hub_manage_modal', 'icon')
                  .addArgs(hubInDb.name)
                  .toString(),
              )
              .setTitle(t({ phrase: 'hub.manage.icon.modal.title', locale }))
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setLabel(t({ phrase: 'hub.manage.icon.modal.label', locale }))
                    .setPlaceholder(
                      t({
                        phrase: 'hub.manage.enterImgurUrl',
                        locale,
                      }),
                    )
                    .setStyle(TextInputStyle.Short)
                    .setCustomId('icon'),
                ),
              );

            await interaction.showModal(modal);
            break;
          }

          case 'description': {
            const modal = new ModalBuilder()
              .setCustomId(
                new CustomID()
                  .setIdentifier('hub_manage_modal', 'description')
                  .addArgs(hubInDb.name)
                  .toString(),
              )
              .setTitle(
                t({
                  phrase: 'hub.manage.description.modal.title',
                  locale,
                }),
              )
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setLabel(
                      t({
                        phrase: 'hub.manage.description.modal.label',
                        locale,
                      }),
                    )
                    .setPlaceholder(
                      t({
                        phrase: 'hub.manage.description.modal.placeholder',
                        locale,
                      }),
                    )
                    .setMaxLength(1024)
                    .setStyle(TextInputStyle.Paragraph)
                    .setCustomId('description'),
                ),
              );

            await interaction.showModal(modal);
            break;
          }

          case 'banner': {
            const modal = new ModalBuilder()
              .setCustomId(
                new CustomID()
                  .setIdentifier('hub_manage_modal', 'banner')
                  .addArgs(hubInDb.name)
                  .toString(),
              )
              .setTitle('Set Hub Banner')
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setLabel(
                      t({
                        phrase: 'hub.manage.banner.modal.label',
                        locale,
                      }),
                    )
                    .setPlaceholder(t({ phrase: 'hub.manage.enterImgurUrl', locale }))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setCustomId('banner'),
                ),
              );

            await interaction.showModal(modal);
            break;
          }

          case 'visibility': {
            const updatedHub = await db.hubs.update({
              where: { id: hubInDb?.id },
              data: { private: !hubInDb?.private },
              include: { connections: true },
            });

            await interaction.reply({
              content: t(
                { phrase: 'hub.manage.visibility.success', locale },
                {
                  emoji: updatedHub.private ? '🔒' : '🔓',
                  visibility: updatedHub.private ? 'private' : 'public',
                },
              ),
              ephemeral: true,
            });

            await interaction.message
              .edit({ embeds: [await hubEmbed(updatedHub)] })
              .catch(() => null);
            break;
          }

          default:
            break;
        }
      }

      // settings menu
      else if (customId.postfix === 'settingsSelect') {
        // respond to select menu
        const selected = interaction.values[0] as HubSettingsString;

        // TODO: implement BlockNSFW, only allow hubs that are explicitly marked as NSFW to have this setting
        // & only allow network channels to be marked as NSFW
        if (selected === 'BlockNSFW') {
          return interaction.reply({
            embeds: [
              simpleEmbed(
                `${emojis.no} This setting cannot be changed yet. Please wait for the next update.`,
              ),
            ],
            ephemeral: true,
          });
        }

        const hubSettings = new HubSettingsBitField(hubInDb.settings);
        const updHub = await db.hubs.update({
          where: { id: hubInDb.id },
          data: { settings: hubSettings.toggle(selected).bitfield }, // toggle the setting
        });

        if (!updHub) {
          await interaction.reply({
            embeds: [simpleEmbed(t({ phrase: 'errors.unknown', locale: interaction.user.locale }))],
            ephemeral: true,
          });
          return;
        }

        const { name, iconUrl, settings } = updHub;

        const embed = buildSettingsEmbed(name, iconUrl, settings);
        const selects = buildSettingsMenu(settings, name, customId.args[0]);

        await interaction.update({
          embeds: [embed],
          components: [selects],
        });
      }
      else if (customId.postfix === 'logsSelect') {
        const type = interaction.values[0] as keyof Prisma.HubLogChannelsCreateInput;

        const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsChSel')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.name)
                .addArgs(type)
                .toString(),
            )
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            )
            .setPlaceholder(`#️⃣ Select a log channel for ${type} logs`),
        );

        // disable log select menu when trying to change channel
        const oldSelect = new ActionRowBuilder<StringSelectMenuBuilder>(
          interaction.message.components[0].toJSON(),
        );
        oldSelect.components[0].setDisabled(true);

        await interaction.update({ components: [oldSelect, channelSelect] });
      }
    }
    else if (interaction.isChannelSelectMenu()) {
      if (customId.postfix === 'logsChSel') {
        const channel = interaction.channels.first();
        const type = customId.args[2];

        await db.hubs.update({
          where: { id: hubInDb.id },
          data: {
            logChannels: {
              upsert: { set: { [type]: channel?.id }, update: { [type]: channel?.id } },
            },
          },
        });

        const embed = new EmbedBuilder()
          .setDescription(
            stripIndents`
            ### <:beta:1170691588607983699> Log Channel Set
    
            ${emojis.yes} <#${channel?.id}> will be used for sending \`${type}\` logs from now on.
            `,
          )
          .setColor(colors.invisible);

        const newComponents = interaction.message.components
          .filter((row, index) => (index === 0 ? row : false))
          .map((row) => row.toJSON());
        newComponents[0].components[0].disabled = false;

        await interaction.update({ embeds: [genLogInfoEmbed(hubInDb)], components: [newComponents[0]] });
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      }
    }
  }

  @RegisterInteractionHandler('hub_manage_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const hubName = customId.args[0];
    const locale = interaction.user.locale || 'en';

    let hubInDb = await db.hubs.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        content: t({ phrase: 'hub.notFound_mod', locale }),
        ephemeral: true,
      });
      return;
    }

    switch (customId.postfix) {
      // update description modal
      case 'description': {
        const description = interaction.fields.getTextInputValue('description');
        await db.hubs.update({
          where: { name: hubName },
          data: { description },
        });

        await interaction.reply({
          content: t({ phrase: 'hub.manage.description.changed', locale }),
          ephemeral: true,
        });
        break;
      }

      // change icon modal
      case 'icon': {
        const newIcon = interaction.fields.getTextInputValue('icon');

        // check if icon is a valid imgur link
        const iconUrl = await checkAndFetchImgurUrl(newIcon);
        if (!iconUrl) {
          await interaction.reply({
            content: t({ phrase: 'hub.invalidImgurUrl', locale }),
            ephemeral: true,
          });
          return;
        }

        await db.hubs.update({
          where: { name: hubName },
          data: { iconUrl },
        });

        await interaction.reply({
          content: t({ phrase: 'hub.manage.icon.changed', locale }),
          ephemeral: true,
        });
        break;
      }

      // change banner modal
      case 'banner': {
        const newBanner = interaction.fields.getTextInputValue('banner');

        if (!newBanner) {
          await db.hubs.update({
            where: { name: hubName },
            data: { bannerUrl: { unset: true } },
          });

          await interaction.reply({
            content: t({ phrase: 'hub.manage.banner.removed', locale }),
            ephemeral: true,
          });
          break;
        }

        const bannerUrl = await checkAndFetchImgurUrl(newBanner);

        // if banner is not a valid imgur link
        if (!bannerUrl) {
          await interaction.reply({
            content: t({ phrase: 'hub.invalidImgurUrl', locale }),
            ephemeral: true,
          });
          return;
        }

        await db.hubs.update({
          where: { name: hubName },
          data: { bannerUrl },
        });

        await interaction.reply({
          content: t({ phrase: 'hub.manage.banner.changed', locale }),
          ephemeral: true,
        });
        break;
      }

      default:
        break;
    }

    // fetch updated data
    hubInDb = await db.hubs.findFirst({
      where: { name: hubName },
      include: { connections: true },
    });

    // update the original message with new embed
    if (hubInDb) {
      await interaction.message
        ?.edit({ embeds: [await hubEmbed(hubInDb)] })
        .catch(() => null);
    }
  }
}
