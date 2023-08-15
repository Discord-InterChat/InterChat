import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { calculateAverageRating, createHubListingsEmbed, getDb } from '../../Utils/functions/utils';
import { paginate } from '../../Utils/functions/paginator';
import { hubs } from '@prisma/client';
import logger from '../../Utils/logger';
import { captureException } from '@sentry/node';

export async function execute(interaction: ChatInputCommandInteraction) {
  const sortBy = interaction.options.getString('sort') as 'connections' | 'active' | 'popular' | 'recent' | undefined;
  const hubName = interaction.options.getString('search') || undefined;

  const db = getDb();
  let sortedHubs: hubs[] = [];


  switch (sortBy) {
    case 'active':
      sortedHubs = await db.hubs.findMany({
        where: { name: hubName, private: false },
        orderBy: { messages: { _count: 'desc' } },
      });
      break;
    case 'popular':
      sortedHubs = (await db.hubs
        .findMany({ where: { name: hubName, private: false } }))
        .sort((a, b) => {
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
    default:
      sortedHubs = await db.hubs.findMany({ where: { name: hubName, private: false } });
      break;
  }


  const hubList = sortedHubs?.map(async (hub) => {
    const totalNetworks = await db.connectedList
      .count({ where: { hubId: hub.id } })
      .catch(() => 0);

    return createHubListingsEmbed(hub, { totalNetworks });
  });

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
  );


  paginate(interaction, await Promise.all(hubList), {
    extraComponent: {
      actionRow: [paginateBtns],
      updateComponents(pageNumber) {
        paginateBtns.components[0].setCustomId(`rate-${sortedHubs[pageNumber].id}`);
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
            .then(async m => {
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
      },
    },
  });
}
