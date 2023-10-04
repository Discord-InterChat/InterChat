import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ChatInputCommandInteraction, EmbedBuilder, GuildTextBasedChannel, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { calculateAverageRating, createHubListingsEmbed, getDb } from '../../Utils/utils';
import { paginate } from '../../Utils/paginator';
import { hubs } from '@prisma/client';
import { captureException } from '@sentry/node';
import logger from '../../Utils/logger';
import emojis from '../../Utils/JSON/emoji.json';
import onboarding from '../network/onboarding';
import { createConnection } from '../../Utils/network';

export default {
  async execute(interaction: ChatInputCommandInteraction) {
    const sortBy = interaction.options.getString('sort') as
    | 'connections'
    | 'active'
    | 'popular'
    | 'recent'
    | undefined;
    const hubName = interaction.options.getString('search') || undefined;

    const db = getDb();
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

        return createHubListingsEmbed(hub, { connections });
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
        .setCustomId(`rate-${sortedHubs[0].id}`)
        .setLabel('Rate')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`join-${sortedHubs[0].id}`)
        .setLabel('Join')
        .setStyle(ButtonStyle.Success),
    );

    paginate(interaction, hubList, {
      extraComponent: {
        actionRow: [paginateBtns],
        updateComponents(pageNumber) {
          paginateBtns.components[0].setCustomId(`rate-${sortedHubs[pageNumber].id}`);
          paginateBtns.components[1].setCustomId(`join-${sortedHubs[pageNumber].id}`);
          return paginateBtns;
        },
        async execute(i: ButtonInteraction) {
          if (i.customId.startsWith('rate-')) {
            const ratingModal = new ModalBuilder()
              .setCustomId(i.id)
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
            await i.showModal(ratingModal);
            i.awaitModalSubmit({ time: 30_000 })
              .then(async (m) => {
                const rating = parseInt(m.fields.getTextInputValue('rating'));
                if (isNaN(rating) || rating < 1 || rating > 5) {
                  return m.reply({
                    content: 'Invalid rating. You must enter a number between 1 and 5.',
                    ephemeral: true,
                  });
                }
                const hubId = i.customId.replace('rate-', '');
                const hubDetails = await db.hubs.findFirst({ where: { id: hubId } });

                if (!hubDetails) {
                  m.reply({
                    content: 'Hub not found.',
                    ephemeral: true,
                  });
                  return;
                }

                const userAlreadyRated = hubDetails.rating.find((r) => r.userId === i.user.id);

                await db.hubs.update({
                  where: { id: hubId },
                  data: {
                    rating: !userAlreadyRated
                      ? { push: { userId: i.user.id, rating } }
                      : { updateMany: { where: { userId: i.user.id }, data: { rating } } },
                  },
                });

                await m.reply({
                  content: 'Rating submitted. Thank you!',
                  ephemeral: true,
                });
              })
              .catch((e) => {
                if (!e.message.includes('ending with reason: time')) {
                  logger.error(e);
                  captureException(e, {
                    user: { username: i.user.username, id: i.user.id },
                    extra: { context: 'Rating modal' },
                  });
                }
              });
          }
          else if (i.customId.startsWith('join-')) {
            const hubDetails = await db.hubs.findFirst({
              where: { id: i.customId.replace('join-', '') },
              include: { connections: true },
            });

            if (!hubDetails) {
              i.reply({
                content: 'Hub not found.',
                ephemeral: true,
              });
              return;
            }

            const alreadyJoined = hubDetails.connections.find((c) => c.serverId === i.guildId);
            if (alreadyJoined) {
              i.reply({
                content: `You have already joined **${hubDetails.name}** from <#${alreadyJoined.channelId}>!`,
                ephemeral: true,
              });
              return;
            }

            let channel = i.channel;

            const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('channel_select')
                .setPlaceholder('Select a different channel.')
                .setChannelTypes([
                  ChannelType.PublicThread,
                  ChannelType.PrivateThread,
                  ChannelType.GuildText,
                ]),
            );

            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger),
            );

            // use current channel embed
            const embed = new EmbedBuilder()
              .setDescription(`
              Are you sure you wish to join **${hubDetails.name}** from ${interaction.channel}?
              
              **Note:** You can always change this later using \`/network manage\`.
            `,
              )
              .setColor('Aqua')
              .setFooter({ text: 'Use a different channel? Use the dropdown below.' });

            const reply = await i.reply({
              embeds: [embed],
              components: [channelSelect, buttons],
              fetchReply: true,
              ephemeral: true,
            });

            const response = await reply
              .awaitMessageComponent({
                time: 60_000 * 2,
                filter: (e) => e.user.id === i.user.id,
              })
              .catch(() => null);

            if (!response?.inCachedGuild() || response.customId === 'cancel') {
              i.deleteReply().catch(() => null);
              return;
            }

            if (response.isChannelSelectMenu()) {
              channel = response.guild.channels.cache.get(response.values[0]) as GuildTextBasedChannel;
            }


            if (channel?.type !== ChannelType.GuildText && !channel?.isThread()) {
              await response.update(`${emojis.normal.no} Only text and thread channels are supported!`);
              return;
            }

            if (!interaction.guild?.members.me?.permissionsIn(channel).has(['ManageWebhooks'])) {
              await response.update(`${emojis.normal.no} I need to have the \`Manage Webhooks\` permission in ${channel} to connect it to a hub!`);
              return;
            }

            if (!response.member.permissionsIn(channel).has('ManageChannels')) {
              await response.update(`${emojis.normal.no} You need to have the \`Manage Channels\` permission in ${channel} to connect it to a hub!`);
              return;
            }

            if (
              (response.customId === 'confirm' || response.customId === 'channel_select')
            ) {
              const channelConnected = await db.connectedList.findFirst({
                where: { channelId: channel.id },
              });

              if (channelConnected) {
                response.update({
                  content: 'This channel is already connected to another hub!',
                  embeds: [],
                  components: [],
                });
                return;
              }

              // Show new users rules & info about network
              const onboardingStatus = await onboarding.execute(response, hubDetails.name, channel.id, true);
              // if user cancelled onboarding or didn't click any buttons, stop here
              if (!onboardingStatus) return interaction.deleteReply().catch(() => null);

              createConnection(response.guild, hubDetails, channel).then((success) => {
                if (success) {
                  response.editReply({
                    content: `Successfully joined hub ${hubDetails.name} from ${channel}! Use \`/network manage\` to manage your connection. And \`/hub leave\` to leave the hub.`,
                    embeds: [],
                    components: [],
                  });
                  return;
                }
                response.message.delete().catch(() => null);
              });
            }
          }
        },
      },
    });
  },
};