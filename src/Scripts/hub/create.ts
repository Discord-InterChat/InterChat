import { captureException } from '@sentry/node';
import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, TextChannel, TextInputStyle } from 'discord.js';
import { getDb, constants } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export default async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) return;

  const hubName = interaction.options.getString('name', true);
  const db = getDb();
  const hubExists = await db.hubs.findFirst({
    where: { name:  hubName },
  });

  if (hubExists) {
    return await interaction.reply({
      content: `Sorry! A hub with the name **${hubName}** already exists! Please choose another name.`,
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setTitle('Create a hub')
    .setCustomId(interaction.id)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setLabel('What is the hub about?')
          .setPlaceholder('A detailed description about your hub.')
          .setMaxLength(1024)
          .setStyle(TextInputStyle.Paragraph)
          .setCustomId('description'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(

        new TextInputBuilder()
          .setLabel('Tags:')
          .setPlaceholder('Seperated by commas. Eg. Gaming, Music, Fun')
          .setMaxLength(100)
          .setStyle(TextInputStyle.Short)
          .setCustomId('tags'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(

        new TextInputBuilder()
          .setLabel('Language')
          .setPlaceholder('Pick the language of the hub.')
          .setStyle(TextInputStyle.Short)
          .setCustomId('language'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(

        new TextInputBuilder()
          .setLabel('Main Server Invite:')
          .setPlaceholder('Set an invite so hub members can join to ask help.')
          .setStyle(TextInputStyle.Short)
          .setCustomId('invite'),
      ),
    );

  await interaction.showModal(modal);

  await interaction.awaitModalSubmit({ time: 60 * 5000 })
    .then(async submitIntr => {
      const description = submitIntr.fields.getTextInputValue('description');
      const tags = submitIntr.fields.getTextInputValue('tags');
      const language = submitIntr.fields.getTextInputValue('language');
      const invite = submitIntr.fields.getTextInputValue('invite');

      const embed = new EmbedBuilder()
        .setTitle(hubName)
        .setDescription(description)
        .setColor('Random')
        .addFields(
          { name: 'Language', value: language, inline: true },
          { name: 'Tags', value: tags, inline: true },
          { name: 'Rating', value: '⭐⭐⭐⭐⭐', inline: true },
          {
            name: 'Extras',
            value: stripIndents`
              Created At: 2023-05-01
              Connected Networks: sjfj
              Messages Today: 3209
              Main Server: [Join](${invite})
            `,
            inline: true,
          });

      const confirmBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
      );

      const confirmMsg = await submitIntr.reply({
        content: 'This is a preview your hub\'s listings embed. Confirm if you want to list your hub publicly:',
        embeds: [embed],
        components: [confirmBtns],
        fetchReply: true,
      });

      const confirmResp = await confirmMsg.awaitMessageComponent({
        filter: i2 => i2.user.id === submitIntr.user.id,
        time: 30_000,
        componentType: ComponentType.Button,
      }).catch(() => null);


      if (confirmResp?.customId === 'confirm') {
        const hubCreate = await db.hubs.create({
          data: {
            name: hubName,
            description,
            private: false,
            tags: tags.split(',').slice(0, 5),
            mainServerId: interaction.guild.id,
            createdAt: new Date(),
            createdByUserId: submitIntr.user.id,
          },
        });

        confirmResp.reply(`Succesfully created hub named **${hubName}**! Please wait while our staff evaluate your hub to see it listed publicly, you can invite other servers to join the hub using \`/hub join hub: ${hubCreate.id}\`.`);

        const { hubReviews } = constants.channel;
        const reviewChannel = await submitIntr.client.channels.fetch(hubReviews) as TextChannel;

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

        const collector = reviewMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          max: 2,
        });

        collector.on('collect', async (reviewInter) => {
          const emoji = interaction.client.emotes.normal;

          if (reviewInter.customId === 'approve') {
            reviewInter.reply({
              content: `${emoji.yes} Approved **${hubName}**! It is now listed on \`/hub browse\`!`,
              ephemeral: true,
            });

            const approvedEmbed = new EmbedBuilder()
              .setTitle('Hub Approved')
              .setDescription(`${emoji.yes} Your hub **${hubName}** has been approved to be publicly listed! View your hub using \`/hub browse\`. If you want to make your hub private, edit it in \`/hub edit\`!`)
              .setColor('Green')
              .setTimestamp()
              .setFooter({ text: 'Join the support server if you have any questions!' });

            // notify hub owner of approval
            await submitIntr.user.send({ embeds: [approvedEmbed] });
            collector.stop();
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
                denyIntr.reply({
                  content: `**${hubName}** has been denied from being listed publicly. Reason: \`${reason}\``,
                  ephemeral: true,
                });

                denyIntr.message?.edit({ content: `${emoji.no} Denied by **${reviewInter.user.tag}**.`, components: [] });

                const denyEmbed = new EmbedBuilder()
                  .setTitle('Hub Denied')
                  .setDescription(`${emoji.no} Your hub **${hubName}** has been denied from being listed publicly.`)
                  .addFields({ name: 'Reason', value: reason })
                  .setColor('Red')
                  .setFooter({ text: 'Join the support server if you have any questions!' })
                  .setTimestamp();

                // notify hub owner of denial
                await submitIntr.user.send({ embeds: [denyEmbed] });
                collector.stop();
              }).catch(e => {
                if (!e.message.includes('ending with reason: time')) {
                  captureException(e);
                  logger.error(e);
                }
              });
          }
        });

      }
      else {
        await confirmResp?.update({ components: [] });
        return;
      }

    })
    .catch(e => {
      if (!e.message.includes('ending with reason: time')) {
        captureException(e);
        logger.error(e);
      }
    });
}