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
} from 'discord.js';
import db from '../../../utils/Db.js';
import Hub from '../../slash/Main/hub.js';
import { hubs } from '@prisma/client';
import { emojis } from '../../../utils/Constants.js';
import { paginate } from '../../../utils/Pagination.js';
import { calculateAverageRating, getOrCreateWebhook } from '../../../utils/Utils.js';
import { showOnboarding } from '../../../scripts/network/onboarding.js';
import { CustomID } from '../../../structures/CustomID.js';
import { Interaction } from '../../../decorators/Interaction.js';
import { stripIndents } from 'common-tags';

export default class Browse extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const sortBy = interaction.options.getString('sort') as
      | 'connections'
      | 'active'
      | 'popular'
      | 'recent'
      | undefined;
    const hubName = interaction.options.getString('search') || undefined;

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
      case 'connections':
        sortedHubs = await db.hubs.findMany({
          where: { name: hubName, private: false },
          orderBy: { connections: { _count: 'desc' } },
        });
        break;

      case 'active':
      default:
        sortedHubs = await db.hubs.findMany({
          where: { name: hubName, private: false },
          orderBy: { messages: { _count: 'desc' } },
        });
        break;
    }

    const hubList = await Promise.all(
      sortedHubs?.map(async (hub) => {
        const connections = await db.connectedList
          .count({ where: { hubId: hub.id, connected: true } })
          .catch(() => 0);

        return Browse.createHubListingsEmbed(hub, connections);
      }),
    );

    if (!hubList || hubList.length === 0) {
      interaction.reply({
        content: 'There are no hubs listed here at the moment. Please try again later!',
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

    paginate(interaction, hubList, {
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

  @Interaction('hub_browse')
  async handleComponents(interaction: ButtonInteraction | ChannelSelectMenuInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);

    if (customId.postfix === 'rate') {
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

    const hubDetails = await db.hubs.findFirst({
      where: { id: customId.args[0] },
      include: { connections: true },
    });


    if (customId.postfix === 'join') {
      if (!hubDetails) {
        return await interaction.reply({
          content: 'Hub not found.',
          ephemeral: true,
        });
      }

      const alreadyJoined = hubDetails.connections.find((c) => c.serverId === interaction.guildId);
      if (alreadyJoined) {
        interaction.reply({
          content: `You have already joined **${hubDetails.name}** from <#${alreadyJoined.channelId}>!`,
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
          stripIndents`
          Are you sure you wish to join **${hubDetails.name}** from ${interaction.channel}?
          
          **Note:** You can always change this later using \`/connection\`.
      `,
        )
        .setColor('Aqua')
        .setFooter({ text: 'Want to use a different channel? Use the dropdown below.' });

      await interaction.reply({
        embeds: [embed],
        components: [channelSelect, buttons],
        ephemeral: true,
      });
    }


    else if (interaction.customId === 'cancel') {
      await interaction.deleteReply().catch(() => null);
      return;
    }


    else if (customId.postfix === 'channel_select' || customId.postfix === 'confirm') {
      if (!hubDetails) {
        return await interaction.reply({
          content: 'Hub not found.',
          ephemeral: true,
        });
      }

      if (!interaction.inCachedGuild()) return;

      const channel = interaction.isChannelSelectMenu()
        ? (interaction.guild?.channels.cache.get(interaction.values[0]))
        : interaction.channel;

      // for type safety
      if (channel?.type !== ChannelType.GuildText && !channel?.isThread()) {
        await interaction.update(`${emojis.no} Only text and thread channels are supported!`);
        return;
      }

      if (!interaction.guild?.members.me?.permissionsIn(channel).has(['ManageWebhooks'])) {
        await interaction.update(
          `${emojis.no} I need to have the \`Manage Webhooks\` permission in ${channel} to connect it to a hub!`,
        );
        return;
      }

      if (!interaction.member.permissionsIn(channel).has('ManageChannels')) {
        await interaction.update(
          `${emojis.no} You need to have the \`Manage Channels\` permission in ${channel} to connect it to a hub!`,
        );
        return;
      }

      if (interaction.customId === 'confirm' || interaction.customId === 'channel_select') {
        const channelConnected = await db.connectedList.findFirst({
          where: { channelId: channel.id },
        });

        if (channelConnected) {
          interaction.update({
            content: 'This channel is already connected to another hub!',
            embeds: [],
            components: [],
          });
          return;
        }

        // Show new users rules & info about network, also prevents user from joining twice
        const onboardingCompleted = await showOnboarding(interaction, hubDetails.name, channel.id);
        // if user cancels onboarding or it times out
        if (!onboardingCompleted) return await interaction.deleteReply().catch(() => null);

        const webhook = await getOrCreateWebhook(channel);
        if (!webhook) return;

        const networkManager = interaction.client.getNetworkManager();
        // finally make the connection
        await networkManager.createConnection({
          serverId: channel.guildId,
          channelId: channel.id,
          parentId: channel.isThread() ? channel.parentId : undefined,
          webhookURL: webhook.url,
          hub: { connect: { id: hubDetails.id } },
          connected: true,
          compact: false,
          profFilter: true,
        });

        await interaction.editReply({
          content: `Successfully joined hub ${hubDetails.name} from ${channel}! Use \`/network manage\` to manage your connection. And \`/hub leave\` to leave the hub.`,
          embeds: [],
          components: [],
        });
      }
    }
  }

  @Interaction('hub_browse_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);

    const rating = parseInt(interaction.fields.getTextInputValue('rating'));
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return await interaction.reply({
        content: 'Invalid rating. You must enter a number between 1 and 5.',
        ephemeral: true,
      });
    }

    const hubId = customId.args[0];
    const hub = await db.hubs.findFirst({ where: { id: hubId } });
    if (!hub) {
      interaction.reply({
        content: 'Hub not found.',
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
      content: 'Rating submitted. Thank you!',
      ephemeral: true,
    });
  }

  // utils
  static createHubListingsEmbed(hub: hubs, connections?: number) {
    return new EmbedBuilder()
      .setDescription(
        stripIndents`
        ### ${hub.name}
        ${hub.description}
  
        **Rating:** ${
  hub.rating?.length > 0
    ? '⭐'.repeat(calculateAverageRating(hub.rating.map((hr) => hr.rating)))
    : '-'
}
        **Connections:** ${connections ?? 'Unknown.'}
        **Created At:** <t:${Math.round(hub.createdAt.getTime() / 1000)}:d>
      `,
      )
      .setColor('Random')
      .setThumbnail(hub.iconUrl)
      .setImage(hub.bannerUrl);
  }
}
