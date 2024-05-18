/* eslint-disable complexity */
import {
  ChatInputCommandInteraction,
  CacheType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ChannelSelectMenuInteraction,
  time,
} from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { hubs } from '@prisma/client';
import { colors, emojis } from '../../../../utils/Constants.js';
import { paginate } from '../../../../utils/Pagination.js';
import {
  calculateAverageRating,
  getOrCreateWebhook,
  parseTimestampFromId,
  sendToHub,
  simpleEmbed,
} from '../../../../utils/Utils.js';
import { showOnboarding } from '../../../../scripts/network/onboarding.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { stripIndents } from 'common-tags';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import { t } from '../../../../utils/Locale.js';

export default class Browse extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const sortBy = interaction.options.getString('sort') as
      | 'servers'
      | 'active'
      | 'popular'
      | 'recent'
      | undefined;
    const hubName = interaction.options.getString('hub') ?? undefined;

    let sortedHubs: hubs[] = [];

    switch (sortBy) {
      case 'popular':
        sortedHubs = (
          await db.hubs.findMany({
            where: { name: hubName, private: false },
            include: { connections: true },
          })
        ).sort((a, b) => {
          const aAverage = calculateAverageRating(a.rating.map((rating) => rating.rating));
          const bAverage = calculateAverageRating(b.rating.map((rating) => rating.rating));
          return bAverage - aAverage;
        });
        break;
      case 'recent':
        sortedHubs = await db.hubs.findMany({
          where: { name: hubName, private: false },
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'servers':
        sortedHubs = await db.hubs.findMany({
          where: { name: hubName, private: false },
          orderBy: { connections: { _count: 'desc' } },
        });
        break;

      case 'active':
      default:
        sortedHubs = await db.hubs.findMany({
          where: { name: hubName, private: false },
          orderBy: { originalMessages: { _count: 'desc' } },
        });
        break;
    }

    const hubList = await Promise.all(
      sortedHubs?.map(async (hub) => {
        const connections = await db.connectedList
          .count({ where: { hubId: hub.id, connected: true } })
          .catch(() => 0);

        const lastMessage = await db.originalMessages.findFirst({
          where: { hubId: hub.id },
          orderBy: { messageId: 'desc' },
        });

        return Browse.createHubListingsEmbed(
          hub,
          connections,
          lastMessage ? new Date(parseTimestampFromId(lastMessage.messageId)) : undefined,
        );
      }),
    );

    if (!hubList || hubList.length === 0) {
      await interaction.reply({
        content: t(
          { phrase: 'hub.browse.noHubs', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
      return;
    }

    const paginateBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID().setIdentifier('hub_browse', 'rate').addArgs(sortedHubs[0].id).toString(),
        )
        .setLabel('Rate')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(
          new CustomID().setIdentifier('hub_browse', 'join').addArgs(sortedHubs[0].id).toString(),
        )
        .setLabel('Join')
        .setStyle(ButtonStyle.Success),
    );

    await paginate(interaction, hubList, {
      extraComponents: {
        actionRow: [paginateBtns],
        updateComponents(pageNumber) {
          paginateBtns.components[0].setCustomId(
            new CustomID()
              .setIdentifier('hub_browse', 'rate')
              .addArgs(sortedHubs[pageNumber].id)
              .toString(),
          );
          paginateBtns.components[1].setCustomId(
            new CustomID()
              .setIdentifier('hub_browse', 'join')
              .addArgs(sortedHubs[pageNumber].id)
              .toString(),
          );

          return paginateBtns;
        },
      },
    });
  }

  @RegisterInteractionHandler('hub_browse')
  static override async handleComponents(
    interaction: ButtonInteraction | ChannelSelectMenuInteraction,
  ): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const { locale } = interaction.user;

    const hubDetails = await db.hubs.findFirst({
      where: { id: customId.args[0] },
      include: { connections: true },
    });
    if (!hubDetails) {
      await interaction.reply({
        content: t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    if (customId.suffix === 'rate') {
      const ratingModal = new ModalBuilder()
        .setCustomId(
          new CustomID().setIdentifier('hub_browse_modal').addArgs(customId.args[0]).toString(),
        )
        .setTitle('Rate Hub')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('rating')
              .setLabel('Rating')
              .setPlaceholder('Rate the hub from 1-5')
              .setMaxLength(1)
              .setValue('5')
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
        );
      await interaction.showModal(ratingModal);
    }
    else if (customId.suffix === 'join') {
      if (!interaction.inCachedGuild()) return;

      const alreadyJoined = hubDetails.connections.find((c) => c.serverId === interaction.guildId);
      if (alreadyJoined) {
        await interaction.reply({
          content: t(
            { phrase: 'hub.alreadyJoined', locale },
            { hub: hubDetails.name, channel: `<#${alreadyJoined.channelId}>`, emoji: emojis.no },
          ),
          ephemeral: true,
        });
        return;
      }
      const { fetchUserBlacklist, fetchServerBlacklist } = BlacklistManager;

      const userBlacklisted = await fetchUserBlacklist(hubDetails.id, interaction.user.id);
      const serverBlacklisted = await fetchServerBlacklist(hubDetails.id, interaction.guildId);

      if (userBlacklisted || serverBlacklisted) {
        const phrase = userBlacklisted ? 'errors.userBlacklisted' : 'errors.serverBlacklisted';

        await interaction.reply({
          embeds: [simpleEmbed(t({ phrase, locale }, { emoji: emojis.no }))],
          ephemeral: true,
        });
        return;
      }

      const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(
            new CustomID()
              .setIdentifier('hub_browse', 'channel_select')
              .addArgs(hubDetails.id)
              .toString(),
          )
          .setPlaceholder('Select a different channel.')
          .setChannelTypes([
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
            ChannelType.GuildText,
          ]),
      );

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('hub_browse', 'confirm').addArgs(hubDetails.id).toString(),
          )
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(new CustomID().setIdentifier('hub_browse', 'cancel').toString())
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
      );

      // use current channel embed
      const embed = new EmbedBuilder()
        .setDescription(
          t(
            {
              phrase: 'hub.browse.joinConfirm',
              locale,
            },
            { hub: hubDetails.name, channel: `${interaction.channel}` },
          ),
        )
        .setColor('Aqua')
        .setFooter({
          text: t({ phrase: 'hub.browse.joinFooter', locale }),
        });

      await interaction.reply({
        embeds: [embed],
        components: [channelSelect, buttons],
        ephemeral: true,
      });
    }
    else if (customId.suffix === 'cancel') {
      await interaction.deferUpdate();
      await interaction.deleteReply().catch(() => null);
      return;
    }
    else if (customId.suffix === 'channel_select' || customId.suffix === 'confirm') {
      if (!interaction.inCachedGuild()) return;

      if (!hubDetails) {
        await interaction.reply({
          content: t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }),
          ephemeral: true,
        });
        return;
      }

      const channel = interaction.isChannelSelectMenu()
        ? interaction.guild?.channels.cache.get(interaction.values[0])
        : interaction.channel;

      // for type safety
      if (channel?.type !== ChannelType.GuildText && !channel?.isThread()) {
        await interaction.reply({
          content: t({ phrase: 'hub.invalidChannel', locale }, { emoji: emojis.no }),
          ephemeral: true,
        });
        return;
      }

      if (!interaction.guild?.members.me?.permissionsIn(channel).has(['ManageWebhooks'])) {
        await interaction.update({
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'errors.botMissingPermissions', locale },
                { permissions: 'Manage Webhooks', emoji: emojis.no },
              ),
              { color: 'Red', title: 'Bot Missing Permissions' },
            ),
          ],
        });
        return;
      }

      if (!interaction.member.permissionsIn(channel).has('ManageMessages')) {
        await interaction.update({
          content: null,
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'errors.missingPermissions', locale },
                { permissions: 'Manage Messages', emoji: emojis.no },
              ),
              { color: 'Red', title: 'Missing Permissions' },
            ),
          ],
        });
        return;
      }

      const channelConnected = await db.connectedList.findFirst({
        where: { channelId: channel.id },
      });

      if (channelConnected) {
        await interaction.update({
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'connection.alreadyConnected', locale },
                { channel: channel.toString(), emoji: emojis.no },
              ),
            ),
          ],
          components: [],
        });
        return;
      }

      // Show new users rules & info about network, also prevents user from joining twice
      const onboardingCompleted = await showOnboarding(
        interaction,
        hubDetails.name,
        channel.id,
        true,
      );
      // if user cancels onboarding or it times out
      if (!onboardingCompleted) {
        await interaction.deleteReply().catch(() => null);
        return;
      }
      else if (onboardingCompleted === 'in-progress') {
        await interaction.update({
          content: t({ phrase: 'onboarding.inProgress', locale }, { channel: `${channel}` }),
          embeds: [],
          components: [],
        });
        return;
      }

      const webhook = await getOrCreateWebhook(channel);
      if (!webhook) return;

      // finally make the connection
      await db.connectedList.create({
        data: {
          serverId: channel.guildId,
          channelId: channel.id,
          parentId: channel.isThread() ? channel.parentId : undefined,
          webhookURL: webhook.url,
          hub: { connect: { id: hubDetails.id } },
          connected: true,
          compact: false,
          profFilter: true,
        },
      });

      await interaction.editReply({
        content: t(
          { phrase: 'hub.join.success', locale },
          { hub: hubDetails.name, channel: channel.toString() },
        ),
        embeds: [],
        components: [],
      });

      const totalConnections = interaction.client.connectionCache.reduce(
        (total, c) => total + (c.hubId === hubDetails.id && c.connected ? 1 : 0),
        0,
      );

      // announce
      await sendToHub(hubDetails.id, {
        username: `InterChat | ${hubDetails.name}`,
        content: stripIndents`
        A new server has joined the hub! ${emojis.clipart}

        **Server Name:** __${interaction.guild.name}__
        **Member Count:** __${interaction.guild.memberCount}__

        We now have **${totalConnections}** servers with us!
      `,
      });

      // log the server join to hub
      await interaction.client.joinLeaveLogger.logServerJoin(hubDetails.id, interaction.guild, {
        totalConnections,
        hubName: hubDetails.name,
      });
    }
  }

  @RegisterInteractionHandler('hub_browse_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const { locale } = interaction.user;

    const rating = parseInt(interaction.fields.getTextInputValue('rating'));
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.browse.rating.invalid', locale }))],
        ephemeral: true,
      });
    }

    const hubId = customId.args[0];
    const hub = await db.hubs.findFirst({ where: { id: hubId } });
    if (!hub) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    const userAlreadyRated = hub.rating.find((r) => r.userId === interaction.user.id);

    await db.hubs.update({
      where: { id: hubId },
      data: {
        rating: !userAlreadyRated
          ? { push: { userId: interaction.user.id, rating } }
          : { updateMany: { where: { userId: interaction.user.id }, data: { rating } } },
      },
    });

    await interaction.reply({
      content: t({ phrase: 'hub.browse.rating.success', locale }),
      ephemeral: true,
    });
  }

  // utils
  static createHubListingsEmbed(hub: hubs, connections?: number, lastMessage?: Date) {
    const rating = calculateAverageRating(hub.rating.map((hr) => hr.rating));
    const stars =
      rating < 5
        ? emojis.star.repeat(rating) + emojis.star_empty.repeat(Math.round(5 - rating))
        : emojis.star.repeat(5);

    const lastMessageTimestamp = lastMessage?.getTime() ?? 0;
    const lastMessageStr = lastMessageTimestamp
      ? `${time(Math.round(lastMessageTimestamp / 1000), 'R')}`
      : '-';
    const hubCreatedAt = time(Math.round(hub.createdAt.getTime() / 1000), 'd');

    return new EmbedBuilder()
      .setTitle(hub.name)
      .setDescription(hub.description)
      .addFields(
        {
          name: 'Information',
          value: stripIndents`
            ${emojis.connect_icon} **Servers:** ${connections ?? 'Unknown.'}
            ${emojis.clock_icon} **Created At:** ${hubCreatedAt}
            ${emojis.chat_icon} **Last Message:** ${lastMessageStr}
          `,
          inline: true,
        },
        {
          name: 'Rating',
          value: `${stars}${rating ? `\n*rated by ${hub.rating.length} users*` : ''}`,
          inline: true,
        },
      )
      .setColor(colors.interchatBlue)
      .setThumbnail(hub.iconUrl)
      .setImage(hub.bannerUrl);
  }
}
