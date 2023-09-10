import { blacklistedServers, blacklistedUsers, connectedList, hubs } from '@prisma/client';
import { captureException } from '@sentry/node';
import { logger } from '@sentry/utils';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import { stripIndents } from 'common-tags';

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const db = getDb();
  const chosenHub = interaction.options.getString('name', true);
  const emotes = interaction.client.emotes;
  let hubInDb = await db.hubs.findFirst({
    where: {
      name: chosenHub,
      OR: [
        { ownerId: interaction.user.id },
        { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
      ],
    },
    include: {
      connections: true,
      blacklistedServers: true,
      blacklistedUsers: true,
    },
  });

  if (!hubInDb) {
    await interaction.followUp(emotes.normal.no + ' Hub not found.');
    return;
  }

  const editButtons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('icon')
        .setLabel('Change Icon')
        .setEmoji('🖼️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('description')
        .setLabel('Edit Description')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tags')
        .setLabel('Edit Tags')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('banner')
        .setLabel('Set Banner')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary),
    );
  const primaryButtons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('visibility')
        .setLabel('Toggle Visibility')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('invites')
        .setLabel('View Invites')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('nickname')
        .setLabel('Toggle Nicknames')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('moderator')
        .setLabel('View Mods')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️'),
    );


  const hubEmbed = (hub: hubs & { connections: connectedList[], blacklistedUsers: blacklistedUsers[], blacklistedServers: blacklistedServers[] }) => {
    return new EmbedBuilder()
      .setTitle(hub.name)
      .setColor('Random')
      .setDescription(stripIndents`
        ${hub.description}
        - __**Tags:**__ ${hub.tags.join(', ')}
        - __**Public:**__ ${hub.private ? emotes.normal.no : emotes.normal.yes}
        - __**Use Nicknames:**__ ${hub.useNicknames ? emotes.normal.yes : emotes.normal.no}
      `)
      .setThumbnail(hub.iconUrl)
      .setImage(hub.bannerUrl)
      .addFields(
        {
          name: 'Blacklists',
          value: stripIndents`
          - Users: ${hub.blacklistedUsers.length.toString()}
          - Servers: ${hub.blacklistedServers.length.toString()}
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
      );

  };

  const reply = await interaction.followUp({
    embeds: [hubEmbed(hubInDb)],
    components: [primaryButtons, editButtons],
  });

  const collector = reply.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    idle: 60_000 * 5,
  });

  collector.on('collect', async (i) => {
    hubInDb = await db.hubs.findFirst({
      where: { id: hubInDb?.id },
      include: {
        connections: true,
        blacklistedServers: true,
        blacklistedUsers: true,
      },
    });
    if (!hubInDb) {
      await i.reply({ content: 'This hub no longer exists!', ephemeral: true });
      return;
    }

    if (i.isButton()) {
      switch (i.customId) {
        case 'icon': {
          const modal = new ModalBuilder()
            .setCustomId(i.id)
            .setTitle('Change Hub Icon')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setLabel('Enter Icon URL')
                  .setPlaceholder('Enter a valid imgur image URL.')
                  .setStyle(TextInputStyle.Short)
                  .setCustomId('icon'),
              ));

          await i.showModal(modal);

          const modalResponse = await i.awaitModalSubmit({
            filter: m => m.customId === modal.data.custom_id,
            time: 60_000 * 5,
          }).catch(e => {
            if (!e.message.includes('ending with reason: time')) {
              logger.error(e);
              captureException(e, {
                user: { id: i.user.id, username: i.user.username },
                extra: { context: 'This happened when user tried to change hub icon.' },
              });
            }
            return null;
          });

          if (!modalResponse) return;

          const newIcon = modalResponse.fields.getTextInputValue('icon');
          // check if icon is a valid imgur link
          const imgurLink = newIcon.match(/\bhttps?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:jpg|jpeg|gif|png|bmp)\b/g);
          if (!imgurLink) {
            await modalResponse.reply({
              content: 'Invalid icon URL. Please make sure it is a valid imgur image URL.',
              ephemeral: true,
            });
            return;
          }

          await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { iconUrl: imgurLink[0] },
          });

          await modalResponse.reply({
            content: 'Successfully updated icon!',
            ephemeral: true,
          });
          break;
        }

        case 'nickname': {
          await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { useNicknames: !hubInDb?.useNicknames },
          });

          await i.reply({
            content: `**${hubInDb?.useNicknames ? 'Usernames' : 'Display Names'}** will now be displayed for user names on messages instead.`,
            ephemeral: true,
          });
          break;
        }

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

          const modalResponse = await i.awaitModalSubmit({
            filter: m => m.customId === modal.data.custom_id,
            time: 60_000 * 5,
          }).catch(e => {
            if (!e.message.includes('ending with reason: time')) {
              logger.error(e);
              captureException(e, {
                user: { id: i.user.id, username: i.user.username },
                extra: { context: 'This happened when user tried to edit hub desc.' },
              });
            }
            return null;
          });

          if (!modalResponse) return;

          const description = modalResponse.fields.getTextInputValue('description');
          await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { description },
          });

          await modalResponse.reply({
            content: 'Successfully updated hub description.',
            ephemeral: true,
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

          const modalResponse = await i.awaitModalSubmit({
            filter: m => m.customId === modal.data.custom_id,
            time: 60_000 * 5,
          }).catch(e => {
            if (!e.message.includes('ending with reason: time')) {
              logger.error(e);
              captureException(e, {
                user: { id: i.user.id, username: i.user.username },
                extra: { context: 'This happened when user tried to edit hub desc.' },
              });
            }
            return null;
          });

          if (!modalResponse) return;

          const newTags = modalResponse.fields.getTextInputValue('tags').trim();

          if (newTags.length < 3 || newTags === '') {
            await modalResponse.reply({
              content: 'Invalid tags.',
              ephemeral: true,
            });
            return;
          }

          await db.hubs.update({
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
            .setTitle('Set Hub Banner')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setLabel('Enter Banner URL')
                  .setPlaceholder('Enter a valid imgur image URL.')
                  .setStyle(TextInputStyle.Short)
                  .setCustomId('banner'),
              ));

          await i.showModal(modal);

          const modalResponse = await i.awaitModalSubmit({
            filter: m => m.customId === modal.data.custom_id,
            time: 60_000 * 5,
          }).catch(e => {
            if (!e.message.includes('ending with reason: time')) {
              logger.error(e);
              captureException(e, {
                user: { id: i.user.id, username: i.user.username },
                extra: { context: 'Occured during hub banner change.' },
              });
            }
            return null;
          });

          if (!modalResponse) return;

          const newBanner = modalResponse.fields.getTextInputValue('banner');
          // check if banner is a valid imgur link
          const imgurLink = newBanner.match(/\bhttps?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:jpg|jpeg|gif|png|bmp)\b/g);
          if (!imgurLink) {
            await modalResponse.reply({
              content: 'Invalid banner URL. Please make sure it is a valid imgur image URL.',
              ephemeral: true,
            });
            return;
          }

          await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { bannerUrl: imgurLink[0] },
          });

          await modalResponse.reply({
            content: 'Successfully updated banner!',
            ephemeral: true,
          });
          break;
        }

        case 'visibility': {
          await db.hubs.update({
            where: { id: hubInDb?.id },
            data: { private: !hubInDb?.private },
          });
          await i.reply({
            content: `Successfully set hub visibility to **${hubInDb?.private ? 'Public' : 'Private'}**.`,
            ephemeral: true,
          });
          break;
        }
        case 'moderator':{
          await i.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('Hub Moderators')
                .setDescription(
                  hubInDb.moderators.length > 0
                    ? hubInDb.moderators
                      .map((mod, index) => `${index + 1}. <@${mod.userId}> - ${mod.position === 'network_mod' ? 'Network Moderator' : 'Hub Manager'}`)
                      .join('\n')
                    : 'There are no moderators for this hub yet.',
                )
                .setColor('Aqua')
                .setTimestamp(),
            ],
            ephemeral: true,
          });
          break;
        }

        case 'invites': {
          if (!hubInDb.private) {
            await i.reply({
              content: 'You can only view invite codes for private hubs.',
              ephemeral: true,
            });
            return;
          }

          const invitesInDb = await db.hubInvites.findMany({ where: { hubId: hubInDb.id } });
          if (invitesInDb.length === 0) {
            await i.reply({
              content: `${emotes.normal.yes} There are no invites to this hub yet.`,
              ephemeral: true,
            });
            return;
          }

          const inviteArr = invitesInDb.map(
            (inv, index) => `${index + 1}. \`${inv.code}\` - <t:${Math.round(inv.expires.getTime() / 1000)}:R>`,
          );


          const inviteEmbed = new EmbedBuilder()
            .setTitle('Invite Codes')
            .setDescription(inviteArr.join('\n'))
            .setColor('Yellow')
            .setTimestamp();

          await i.reply({
            embeds: [inviteEmbed],
            ephemeral: true,
          });
          break;
        }

        default:
          break;
      }

      hubInDb = await db.hubs.findFirst({
        where: { id: hubInDb?.id },
        include: {
          messages: true,
          connections: true,
          blacklistedServers: true,
          blacklistedUsers: true,
        },
      });
      if (hubInDb) {
        await interaction.editReply({ embeds: [hubEmbed(hubInDb)] }).catch(() => null);
      }
    }
  });

  collector.on('end', async () => {
    editButtons.components.forEach(c => c.setDisabled(true));
    primaryButtons.components.forEach(c => c.setDisabled(true));
    await interaction.editReply({
      components: [primaryButtons, editButtons],
    }).catch(() => null);
  });
}
