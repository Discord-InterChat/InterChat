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
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { t } from '../../../../utils/Locale.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { colors, emojis } from '../../../../utils/Constants.js';
import { Prisma } from '@prisma/client';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { buildSettingsEmbed, buildSettingsMenu } from '../../../../scripts/hub/settings.js';
import { HubSettingsBitField, HubSettingsString } from '../../../../utils/BitFields.js';
import { checkAndFetchImgurUrl, simpleEmbed, setComponentExpiry } from '../../../../utils/Utils.js';
import { actionsSelect, hubEmbed } from '../../../../scripts/hub/manage.js';
import { genLogInfoEmbed } from '../../../../scripts/hub/logs.js';
import HubLoggerService from '../../../../services/HubLoggerService.js';

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
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.notFound_mod', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
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
            .addArgs(hubInDb.id)
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
            .addArgs(hubInDb.id)
            .toString(),
        ),
    );

    await interaction.reply({
      embeds: [await hubEmbed(hubInDb)],
      components: [actionsSelect(hubInDb.id, interaction.user.id, interaction.user.locale), button],
    });

    // disable components after 5 minutes
    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 5000,
    );
  }

  @RegisterInteractionHandler('hub_manage')
  static override async handleComponents(interaction: MessageComponentInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const locale = interaction.user.locale;

    if (customId.args[0] !== interaction.user.id) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.notYourAction', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    const hubInDb = await db.hubs.findFirst({
      where: { id: customId.args[1] },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    // settings button
    if (interaction.isButton()) {
      if (customId.suffix === 'settingsBtn') {
        const { id, name, iconUrl, settings } = hubInDb;
        const embed = buildSettingsEmbed(name, iconUrl, settings);
        const selects = buildSettingsMenu(settings, id, customId.args[0]);

        await interaction.reply({ embeds: [embed], components: [selects], ephemeral: true });
      }
      else if (customId.suffix === 'logsBtn' || customId.suffix === 'logsBackBtn') {
        const embed = genLogInfoEmbed(hubInDb, locale);

        const selects = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsSelect')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.id)
                .toString(),
            )
            .setPlaceholder('Choose a log type to set a channel.')
            .addOptions([
              {
                label: t({ phrase: 'hub.manage.logs.reports.label', locale }),
                value: 'reports',
                description: t({ phrase: 'hub.manage.logs.reports.description', locale }),
                emoji: '📢',
              },
              {
                label: t({ phrase: 'hub.manage.logs.modLogs.label', locale }),
                value: 'modLogs',
                description: t({ phrase: 'hub.manage.logs.modLogs.description', locale }),
                emoji: '👮',
              },
              {
                label: t({ phrase: 'hub.manage.logs.profanity.label', locale }),
                value: 'profanity',
                description: t({ phrase: 'hub.manage.logs.profanity.description', locale }),
                emoji: '🤬',
              },
              // {
              //   label: 'Message Edits',
              //   value: 'msgEdits',
              //   description: 'Log message edits.',
              //   emoji: '📝',
              // },
              // {
              //   label: 'Message Deletes',
              //   value: 'msgDeletes',
              //   description: 'Log message deletes.',
              //   emoji: '🗑️',
              // },
              {
                label: t({ phrase: 'hub.manage.logs.joinLeave.label', locale }),
                value: 'joinLeaves',
                description: t({ phrase: 'hub.manage.logs.joinLeave.description', locale }),
                emoji: '👋',
              },
            ]),
        );

        const msgToSend = { embeds: [embed], components: [selects], ephemeral: true };
        customId.suffix === 'logsBtn'
          ? await interaction.reply(msgToSend)
          : await interaction.update(msgToSend);
      }
      else if (customId.suffix === 'logsDel') {
        const type = customId.args[2] as keyof Prisma.HubLogChannelsCreateInput;

        if (type === 'reports') {
          await interaction.client.reportLogger.removeReports(hubInDb.id);
        }
        else {
          const currentConfig = hubInDb.logChannels;
          if (currentConfig) {
            // remove the channel key and value from the config
            delete currentConfig[type];
          }

          await db.hubs.update({
            where: { id: hubInDb.id },
            data: { logChannels: currentConfig ? { set: currentConfig } : { unset: true } },
          });
        }

        await interaction.reply({
          embeds: [
            simpleEmbed(
              t({ phrase: 'hub.manage.logs.reset', locale }, { emoji: emojis.delete, type }),
            ),
          ],
          ephemeral: true,
        });
      }
    }

    // hub manage selects/toggle settings menu
    else if (interaction.isStringSelectMenu()) {
      if (customId.suffix === 'actions') {
        switch (interaction.values[0]) {
          case 'icon': {
            const modal = new ModalBuilder()
              .setCustomId(
                new CustomID()
                  .setIdentifier('hub_manage_modal', 'icon')
                  .addArgs(hubInDb.id)
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
                  .addArgs(hubInDb.id)
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
                  .addArgs(hubInDb.id)
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
      else if (customId.suffix === 'settingsSelect') {
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
            embeds: [
              simpleEmbed(
                t(
                  { phrase: 'errors.unknown', locale: interaction.user.locale },
                  { emoji: emojis.no },
                ),
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const { id, name, iconUrl, settings } = updHub;

        const embed = buildSettingsEmbed(name, iconUrl, settings);
        const selects = buildSettingsMenu(settings, id, customId.args[0]);

        await interaction.update({
          embeds: [embed],
          components: [selects],
        });
      }
      else if (customId.suffix === 'logsSelect') {
        const type = interaction.values[0] as keyof Prisma.HubLogChannelsCreateInput;
        const logChannel = hubInDb.logChannels ? hubInDb.logChannels[type] : null;

        const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsChSel')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.id)
                .addArgs(type)
                .toString(),
            )
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            )
            .setPlaceholder(t({ phrase: 'hub.manage.logs.channelSelect', locale })),
        );

        const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsRoleSel')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.id)
                .addArgs(type)
                .toString(),
            )
            .setPlaceholder(t({ phrase: 'hub.manage.logs.roleSelect', locale })),
        );

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setEmoji(emojis.back)
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsBackBtn')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.id)
                .addArgs(type)
                .toString(),
            ),
          new ButtonBuilder()
            .setEmoji(emojis.delete)
            .setStyle(ButtonStyle.Danger)
            .setCustomId(
              new CustomID()
                .setIdentifier('hub_manage', 'logsDel')
                .addArgs(interaction.user.id)
                .addArgs(hubInDb.id)
                .addArgs(type)
                .toString(),
            ),
        );

        // disable log select menu when trying to change channel
        const embed = new EmbedBuilder()
          .setTitle(t({ phrase: 'hub.manage.logs.config.title', locale }, { type }))
          .setDescription(
            t({ phrase: 'hub.manage.logs.config.description', locale }, { arrow: emojis.arrow }),
          )
          .addFields(
            typeof logChannel === 'string'
              ? [
                {
                  name: t({ phrase: 'hub.manage.logs.config.fields.channel', locale }),
                  value: logChannel ? `<#${logChannel}>` : 'N/A',
                },
              ]
              : [
                {
                  name: t({ phrase: 'hub.manage.logs.config.fields.channel', locale }),
                  value: logChannel?.channelId ? `<#${logChannel.channelId}>` : 'N/A',
                  inline: true,
                },
                {
                  name: t({ phrase: 'hub.manage.logs.config.fields.role', locale }),
                  value: logChannel?.roleId ? `<@&${logChannel.roleId}>` : 'N/A',
                  inline: true,
                },
              ],
          )
          .setColor(colors.invisible);

        // reports have both channel and role selects
        const componentsToSend =
          type === 'reports' ? [channelSelect, roleSelect, buttons] : [channelSelect, buttons];

        await interaction.update({ embeds: [embed], components: componentsToSend });
      }
    }

    // channel selects
    else if (interaction.isChannelSelectMenu()) {
      if (customId.suffix === 'logsChSel') {
        const type = customId.args[2] as keyof Prisma.HubLogChannelsCreateInput;

        const channelId = interaction.values[0];
        const channel = interaction.channels.first();

        // set the channel in the db
        await HubLoggerService.setLogChannelFor(hubInDb.id, type, channelId);

        // update the old embed with new channel value
        const embed = interaction.message.embeds[0].toJSON();
        if (embed.fields?.at(0)) embed.fields[0].value = `${channel || 'None'}`;
        await interaction.update({ embeds: [embed] });

        await interaction.followUp({
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'hub.manage.logs.channelSuccess', locale },
                { emoji: emojis.yes, type, channel: `${channel}` },
              ),
            ),
          ],
          ephemeral: true,
        });
      }
    }

    // role selects
    else if (interaction.isRoleSelectMenu()) {
      if (customId.suffix === 'logsRoleSel') {
        const role = interaction.roles.first();
        const type = customId.args[2] as keyof Prisma.HubLogChannelsCreateInput;

        if (type === 'reports' && role?.id) {
          if (!hubInDb.logChannels?.reports?.channelId) {
            await interaction.reply({
              embeds: [
                simpleEmbed(
                  t({ phrase: 'hub.manage.logs.reportChannelFirst', locale }, { emoji: emojis.no }),
                ),
              ],
              ephemeral: true,
            });
            return;
          }

          await interaction.client.reportLogger.setRoleId(hubInDb, role.id);
        }

        // update the old embed with new role value
        const embed = interaction.message.embeds[0].toJSON();
        if (embed.fields?.at(1)) embed.fields[1].value = `${role || 'None'}`;

        await interaction.update({ embeds: [embed] });
        await interaction.followUp({
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'hub.manage.logs.roleSuccess', locale },
                { emoji: emojis.yes, type, role: `${role}` },
              ),
            ),
          ],
          ephemeral: true,
        });
      }
    }
  }

  @RegisterInteractionHandler('hub_manage_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const hubId = customId.args[0];
    const locale = interaction.user.locale || 'en';

    let hubInDb = await db.hubs.findFirst({
      where: {
        id: hubId,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        content: t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    switch (customId.suffix) {
      // update description modal
      case 'description': {
        const description = interaction.fields.getTextInputValue('description');
        await db.hubs.update({
          where: { id: hubId },
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
            content: t({ phrase: 'hub.invalidImgurUrl', locale }, { emoji: emojis.no }),
            ephemeral: true,
          });
          return;
        }

        await db.hubs.update({
          where: { id: hubId },
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
        // sometimes it takes a while to fetch the image
        await interaction.deferReply({ ephemeral: true });

        const newBanner = interaction.fields.getTextInputValue('banner');

        if (!newBanner) {
          await db.hubs.update({
            where: { id: hubId },
            data: { bannerUrl: { unset: true } },
          });

          await interaction.editReply(t({ phrase: 'hub.manage.banner.removed', locale }));
          break;
        }

        const bannerUrl = await checkAndFetchImgurUrl(newBanner);

        // if banner is not a valid imgur link
        if (!bannerUrl) {
          await interaction.editReply(
            t({ phrase: 'hub.invalidImgurUrl', locale }, { emoji: emojis.no }),
          );
          return;
        }

        await db.hubs.update({
          where: { id: hubId },
          data: { bannerUrl },
        });

        await interaction.editReply(
          emojis.yes + t({ phrase: 'hub.manage.banner.changed', locale }),
        );
        break;
      }

      default:
        break;
    }

    // fetch updated data
    hubInDb = await db.hubs.findFirst({
      where: { id: hubId },
      include: { connections: true },
    });

    // update the original message with new embed
    if (hubInDb) {
      await interaction.message?.edit({ embeds: [await hubEmbed(hubInDb)] }).catch(() => null);
    }
  }
}
