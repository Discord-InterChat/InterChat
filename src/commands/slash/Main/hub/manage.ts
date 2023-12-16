import db from '../../../../utils/Db.js';
import Hub from './index.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
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
import { hubs, connectedList } from '@prisma/client';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { buildSettingsEmbed, buildSettingsMenu } from '../../../../scripts/hub/settings.js';
import { HubSettingsBitField, HubSettingsString } from '../../../../utils/BitFields.js';
import { checkAndFetchImgurUrl, simpleEmbed, setComponentExpiry } from '../../../../utils/Utils.js';

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
    );

    await interaction.reply({
      embeds: [await Manage.hubEmbed(hubInDb)],
      components: [
        Manage.actionsSelect(hubInDb.name, interaction.user.id, interaction.user.locale),
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
              .edit({ embeds: [await Manage.hubEmbed(updatedHub)] })
              .catch(() => null);
            break;
          }

          default:
            break;
        }
      }

      // settings menu
      else if (customId.postfix === 'settingsToggle') {
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
            embeds: [simpleEmbed(t({ phrase: 'errors.unknown', locale: 'en' }))],
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
        ?.edit({ embeds: [await Manage.hubEmbed(hubInDb)] })
        .catch(() => null);
    }
  }

  // utility methods
  static actionsSelect(hubName: string, userId: string, locale = 'en') {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_manage', 'actions')
            .addArgs(userId)
            .addArgs(hubName)
            .toString(),
        )
        .addOptions([
          {
            label: t({ phrase: 'hub.manage.description.selects.label', locale }),
            value: 'description',
            description: t({ phrase: 'hub.manage.description.selects.description', locale }),
            emoji: '✏️',
          },
          {
            label: t({ phrase: 'hub.manage.visibility.selects.label', locale }),
            value: 'visibility',
            description: t({ phrase: 'hub.manage.visibility.selects.description', locale }),
            emoji: '🔒',
          },
          {
            label: t({ phrase: 'hub.manage.icon.selects.label', locale }),
            value: 'icon',
            description: t({ phrase: 'hub.manage.icon.selects.description', locale }),
            emoji: '🖼️',
          },
          {
            label: t({ phrase: 'hub.manage.banner.selects.label', locale }),
            value: 'banner',
            description: t({ phrase: 'hub.manage.banner.selects.description', locale }),
            emoji: '🎨',
          },
        ]),
    );
  }

  static async hubEmbed(hub: hubs & { connections: connectedList[] }) {
    const hubBlacklistedUsers = await db.userData.count({
      where: { blacklistedFrom: { some: { hubId: hub.id } } },
    });
    const hubBlacklistedServers = await db.blacklistedServers.count({
      where: { hubs: { some: { hubId: hub.id } } },
    });

    return new EmbedBuilder()
      .setTitle(hub.name)
      .setColor(colors.interchatBlue)
      .setDescription(
        stripIndents`
      ${hub.description}
      - __**Public:**__ ${hub.private ? emojis.no : emojis.yes}
    `,
      )
      .setThumbnail(hub.iconUrl)
      .setImage(hub.bannerUrl)
      .addFields(
        {
          name: 'Blacklists',
          value: stripIndents`
        - Users: ${hubBlacklistedUsers}
        - Servers: ${hubBlacklistedServers}
        `,
          inline: true,
        },

        {
          name: 'Hub Stats',
          value: stripIndents`
        - Moderators: ${hub.moderators.length.toString()}
        - Connected: ${hub.connections.length}
        - Owner: <@${hub.ownerId}>
        `,
          inline: true,
        },
        {
          name: 'Log Channels',
          value: stripIndents`
          - Profanity: ${
  hub?.logChannels?.profanity ? `<#${hub?.logChannels?.profanity}>` : emojis.no
}
          - Mod Logs: ${hub?.logChannels?.modLogs ? `<#${hub?.logChannels?.modLogs}>` : emojis.no}
          - Reports: ${hub?.logChannels?.reports ? `<#${hub?.logChannels?.reports}>` : emojis.no}
          `,
        },
      );
  }
}
