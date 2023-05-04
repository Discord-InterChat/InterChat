import { captureException } from '@sentry/node';
import { logger } from '@sentry/utils';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, ModalBuilder, TextChannel, TextInputBuilder, TextInputStyle } from 'discord.js';
import { constants, createHubListingsEmbed, getDb } from '../../Utils/functions/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  const db = getDb();
  const chosenHub = interaction.options.getString('name', true);
  const emotes = interaction.client.emotes;

  let hubInDb = await db.hubs.findFirst({ where: { name: chosenHub } });
  if (!hubInDb) {
    await interaction.reply({
      content: emotes.normal.no + ' Hub not found.',
      ephemeral: true,
    });
    return;
  }

  const editActionBtns = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('description')
        .setLabel('Edit Description')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tags')
        .setLabel('Edit Tags')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('banner')
        .setLabel('Set Banner')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('joinReqs')
        .setLabel('Join Requests')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Secondary),

    );
  const dangerActionBtns = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('visibility')
        .setLabel('Toggle Visibility')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('listHub')
        .setLabel('List Publicly')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('delete')
        .setLabel('Delete Hub')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emotes.icons.delete),
      new ButtonBuilder()
        .setCustomId('moderator')
        .setLabel('Manage Moderators')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️'),
    );

  const reply = await interaction.reply({
    embeds: [createHubListingsEmbed(hubInDb)],
    components: [editActionBtns, dangerActionBtns],
  });

  const collector = reply.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    idle: 60_000 * 5,
  });

  collector.on('collect', async (i) => {
    if (i.isButton()) {
      switch (i.customId) {
        case 'description': {
          const modal = new ModalBuilder()
            .setCustomId(i.id)
            .setTitle('Edit Hub Description')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setLabel('Enter Description')
                  .setPlaceholder('A detailed description about the hub.')
                  .setMaxLength(1024)
                  .setStyle(TextInputStyle.Paragraph)
                  .setCustomId('description'),
              ),
            );

          await i.showModal(modal);

          const modalResponse = await i.awaitModalSubmit({ time: 60_000 * 5 })
            .catch(e => {
              if (!e.message.includes('ending with reason: time')) {
                logger.error(e);
                captureException(e, {
                  user: { id: i.user.id, username: i.user.tag },
                  extra: { context: 'This happened when user tried to edit hub desc.' },
                });
              }
              return null;
            });

          if (!modalResponse) break;

          const description = modalResponse.fields.getTextInputValue('description');
          hubInDb = await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { description },
          });

          await modalResponse.reply({
            content: 'Successfully updated hub description.',
            ephemeral: true,
          });
          break;
        }

        case 'listHub': {
          hubInDb = await db.hubs.findFirst({ where: { id: hubInDb?.id } });
          if (!hubInDb) {
            await i.reply({
              content: 'Something went wrong! Please try again later.',
              ephemeral: true,
            });
            break;
          }
          else if (hubInDb.reviewed) {
            await i.reply({
              content: 'Your hub is already approved to be listed publicly! Toggle the visibility instead.',
              ephemeral: true,
            });
            break;
          }

          const embed = createHubListingsEmbed(hubInDb);

          const confirmBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_listing')
              .setLabel('Confirm')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel_listing')
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Danger),
          );

          const confirmMsg = await i.reply({
            content: 'This is a preview your hub\'s listings embed. Confirm if you want to list your hub publicly:',
            embeds: [embed],
            components: [confirmBtns],
            fetchReply: true,
          });

          const confirmResp = await confirmMsg.awaitMessageComponent({
            filter: i2 => i2.user.id === i.user.id,
            time: 30_000,
            componentType: ComponentType.Button,
          }).catch(() => null);

          if (!confirmResp) {
            await confirmMsg.edit({
              components: [],
              content: 'You took too long to respond. Please try again.',
            });
            break;
          }

          if (confirmResp.customId !== 'confirm_listing') {
            await confirmResp.update({ components: [] });
            break;
          }
          confirmResp.reply('Please wait while our staff review your hub to be listed publicly. In the meantime, you can invite other servers to join your hub using the Hub\'s ID. Thank you for your patience!');
          await confirmResp.message.edit({ components: [] }).catch(() => null);


          const { hubReviews } = constants.channel;
          const reviewChannel = await i.client.channels.fetch(hubReviews) as TextChannel;

          confirmBtns.components[0]
            .setCustomId('approve')
            .setLabel('Approve');
          confirmBtns.components[1]
            .setCustomId('deny')
            .setLabel('Deny');


          const reviewMsg = await reviewChannel?.send({
            embeds: [embed],
            components: [confirmBtns],
          });

          const reviewCollector = reviewMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            max: 2,
          });

          reviewCollector.on('collect', async (reviewInter) => {
            const emoji = interaction.client.emotes.normal;

            if (reviewInter.customId === 'approve') {
              await reviewInter.reply({
                content: `${emoji.yes} Approved! It is now listed on \`/hub browse\`!`,
                ephemeral: true,
              });
              reviewInter.message?.edit({ content: `${emoji.yes} Approved by **${reviewInter.user.tag}**.`, components: [] }).catch(() => null);


              // update hub to be public
              const approvedHub = await db.hubs.update({
                where: { id: hubInDb?.id },
                data: { reviewed: true, private: false },
              });

              const approvedEmbed = new EmbedBuilder()
                .setTitle(`${emoji.yes} Hub Approved`)
                .setDescription(`Your hub **${approvedHub.name}** has been approved to be listed publicly! View your hub using \`/hub browse\`. If you want to make your hub private, edit it in \`/hub edit\`!`)
                .setColor('Green')
                .setTimestamp()
                .setFooter({ text: 'Join the support server if you have any questions!' });

              // notify hub owner of approval
              await i.user.send({ embeds: [approvedEmbed] });
              reviewCollector.stop();
            }
            else {
              const denyModal = new ModalBuilder()
                .setTitle('Deny Hub')
                .setCustomId(reviewInter.id)
                .addComponents(
                  new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                      .setLabel('Reason for Denial')
                      .setStyle(TextInputStyle.Paragraph)
                      .setCustomId('reason'),
                  ),
                );
              await reviewInter.showModal(denyModal);

              reviewInter.awaitModalSubmit({ time: 60 * 5000 })
                .then(async denyIntr => {
                  const reason = denyIntr.fields.getTextInputValue('reason');

                  hubInDb = await db.hubs.findFirst({ where: { id: hubInDb?.id } });
                  if (!hubInDb) {
                    await i.reply({
                      content: 'This hub no longer exists.',
                      ephemeral: true,
                    });
                    return;
                  }

                  await denyIntr.reply({
                    content: `Successfully deined hub **${hubInDb?.name}** from being listed publicly. Reason: \`${reason}\``,
                    ephemeral: true,
                  });
                  denyIntr.message?.edit({ content: `${emoji.no} Denied by **${reviewInter.user.tag}**.`, components: [] }).catch(() => null);

                  const denyEmbed = new EmbedBuilder()
                    .setTitle(`${emoji.no} Hub Denied`)
                    .setDescription('Your request to list your hub on `/hub browse` has been denied! You can edit your hub in `/hub manage` and send it for approval again is applicable.')
                    .addFields(
                      { name: 'Hub Name', value: hubInDb.name, inline: true },
                      { name: 'Reason', value: reason, inline: true },
                    )
                    .setColor('Red')
                    .setFooter({ text: 'Join the support server if you have any questions!' })
                    .setTimestamp();

                  // notify hub owner of denial
                  await i.user.send({ embeds: [denyEmbed] });
                  reviewCollector.stop();
                }).catch(e => {
                  if (!e.message.includes('ending with reason: time')) {
                    captureException(e);
                    logger.error(e);
                  }
                });
            }
          });
          break;
        }

        case 'tags': {
          const modal = new ModalBuilder()
            .setCustomId(i.id)
            .setTitle('Edit Hub Tags')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setLabel('Enter Tags')
                  .setPlaceholder('Seperate each tag with a comma.')
                  .setMaxLength(1024)
                  .setStyle(TextInputStyle.Paragraph)
                  .setCustomId('tags'),
              ),
            );

          await i.showModal(modal);

          const modalResponse = await i.awaitModalSubmit({ time: 60_000 * 5 })
            .catch(e => {
              if (!e.message.includes('ending with reason: time')) {
                logger.error(e);
                captureException(e, {
                  user: { id: i.user.id, username: i.user.tag },
                  extra: { context: 'This happened when user tried to edit hub desc.' },
                });
              }
              return null;
            });

          if (!modalResponse) break;

          const newTags = modalResponse.fields.getTextInputValue('tags');
          hubInDb = await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { tags: newTags.length > 1 ? newTags.replaceAll(', ', ',').split(',', 5) : [newTags] },
          });
          await modalResponse.reply({
            content: 'Successfully updated tags!',
            ephemeral: true,
          });
          break;
        }

        case 'banner': {
          const modal = new ModalBuilder()
            .setCustomId(i.id)
            .setTitle('Edit Hub Banner')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setLabel('Enter Banner URL')
                  .setPlaceholder('Enter a valid imgur image URL.')
                  .setStyle(TextInputStyle.Paragraph)
                  .setCustomId('banner'),
              ));

          await i.showModal(modal);

          const modalResponse = await i.awaitModalSubmit({ time: 60_000 * 5 })
            .catch(e => {
              if (!e.message.includes('ending with reason: time')) {
                logger.error(e);
                captureException(e, {
                  user: { id: i.user.id, username: i.user.tag },
                  extra: { context: 'This happened when user tried to edit hub banner url.' },
                });
              }
              return null;
            });

          if (!modalResponse) break;

          const newBanner = modalResponse.fields.getTextInputValue('banner');
          // check if banner is a valid imgur link
          if (!newBanner.startsWith('https://i.imgur.com/')) {
            await modalResponse.reply({
              content: 'Invalid banner URL. Please make sure it is a valid imgur image URL.',
              ephemeral: true,
            });
          }

          hubInDb = await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { bannerUrl: newBanner },
          });

          await modalResponse.reply({
            content: 'Successfully updated banner!',
            ephemeral: true,
          });
          break;
        }

        case 'visibility': {
          hubInDb = await db.hubs.findFirst({ where: { id: hubInDb?.id } });
          if (!hubInDb?.reviewed && hubInDb?.private) {
            await i.reply({
              content: 'This hub is not yet reviewed. Please submit it for review first by clicking the **List Publicly** button.',
              ephemeral: true,
            });
            break;
          }

          hubInDb = await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { private: !hubInDb?.private },
          });
          await i.reply({
            content: `Successfully set hub visibility to **${hubInDb?.private ? 'Private' : 'Public'}**.`,
            ephemeral: true,
          });
          break;
        }
        case 'delete': {
          const confirmEmbed = new EmbedBuilder()
            .setTitle('Are you sure?')
            .setDescription('Are you sure you want to delete this hub? This is a destructive action that will **delete all connections** along with the hub.')
            .setColor('Yellow');
          const confirmButtons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Confirm')
                .setCustomId('confirm_delete')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setLabel('Cancel')
                .setCustomId('cancel_delete')
                .setStyle(ButtonStyle.Secondary),
            );

          const msg = await i.reply({
            embeds: [confirmEmbed],
            components: [confirmButtons],
          });

          const confirmation = await msg.awaitMessageComponent({
            filter: b => b.user.id === i.user.id,
            time: 30_000,
            componentType: ComponentType.Button,
          }).catch(() => null);

          if (!confirmation || confirmation.customId !== 'confirm_delete') {
            await msg.delete().catch(() => null);
            break;
          }
          try {
            await db.connectedList.deleteMany({ where: { hubId: hubInDb?.id } });
            await db.hubs.delete({ where: { id: hubInDb?.id } });
            hubInDb = null;
          }
          catch (e) {
            logger.error(e);
            captureException(e, {
              user: { id: i.user.id, username: i.user.tag },
              extra: { context: 'Trying to delete hub.', hubId: hubInDb?.id },
            });

            await confirmation.reply({
              content: 'Something went wrong while trying to delete the hub. The developers have been notified.',
              ephemeral: true,
            });
            break;
          }
          await confirmation.reply({
            content: 'The hub has been successfully deleted.',
            ephemeral: true,
          });
          break;
        }

        case 'moderator':
          i.reply('This is still a WIP.');
          break;

        case 'joinReqs': {
          hubInDb = await db.hubs.findFirst({ where: { id: hubInDb?.id } });
          if (!hubInDb) {
            await i.reply({
              content: 'Something went wrong while trying to fetch the hub. Please try again or contact the developers.',
              ephemeral: true,
            });
            break;
          }

          if (!hubInDb.private) {
            await i.reply({
              content: 'This hub is not private. You can only view join requests for private hubs.',
              ephemeral: true,
            });
            break;
          }

          else if (hubInDb.joinRequests.length === 0) {
            await i.reply({
              content: `${emotes.normal.yes} There are no join requests for this hub.`,
              ephemeral: true,
            });
            break;
          }

          const joinRequests = hubInDb.joinRequests.map(async (jr, index) => {
            const server = await i.client.guilds.fetch(jr.serverId).catch(() => null);
            const channel = await server?.channels.fetch(jr.channelId).catch(() => null);
            const serverOwner = await server?.fetchOwner().catch(() => null);

            return server ? `${index + 1}. \`${server.name} #${channel?.name}\` - ${serverOwner?.user.tag}` : `${jr} (Unknown Server)`;
          });

          const resolvedJoinRequests = await Promise.all(joinRequests);

          const joinRequestsEmbed = new EmbedBuilder()
            .setTitle('Join Requests')
            .setDescription(resolvedJoinRequests.join('\n'))
            .setColor('Yellow')
            .setTimestamp();

          await i.reply({
            embeds: [joinRequestsEmbed],
            ephemeral: true,
          });
          break;
        }

        default:
          break;
      }

      if (hubInDb) {
        await i.message.edit({
          embeds: [createHubListingsEmbed(hubInDb)],
        }).catch(() => null);
      }
    }
    collector.on('end', async () => {
      editActionBtns.components.forEach(c => c.setDisabled(true));
      dangerActionBtns.components.forEach(c => c.setDisabled(true));
      await i.message.edit({
        components: [editActionBtns, dangerActionBtns],
      }).catch(() => null);
    });
  });
}
