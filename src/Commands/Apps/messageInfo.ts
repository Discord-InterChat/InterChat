import { ActionRowBuilder, ApplicationCommandType, AttachmentBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContextMenuCommandBuilder, EmbedBuilder, GuildTextBasedChannel, MessageContextMenuCommandInteraction, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { constants, getDb } from '../../Utils/utils';
import { stripIndents } from 'common-tags';
import { profileImage } from 'discord-arts';
import emojis from '../../Utils/JSON/emoji.json';
import { captureException } from '@sentry/node';
import logger from '../../Utils/logger';

export default {
  description: 'Get information about this message, user and server it was sent from!',
  data: new ContextMenuCommandBuilder()
    .setName('Message Info')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const target = interaction.targetMessage;
    const networkMessage = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target.id } } },
      include: { hub: true },
    });

    if (!networkMessage) {
      await interaction.reply({
        content: 'Information about this message is no longer available.',
        ephemeral: true,
      });
      return;
    }

    const author = await interaction.client.users.fetch(networkMessage.authorId);
    const server = await interaction.client.guilds.fetch(networkMessage.serverId).catch(() => null);

    const embed = new EmbedBuilder()
      .setThumbnail(author.displayAvatarURL())
      .setDescription(stripIndents`
        ## ${emojis.normal.clipart} Message Info

        **Sent By:** 
        __${author.username}__${author.discriminator !== '0' ? `#${author.discriminator}` : ''} ${author.bot ? '(Bot)' : ''}

        **Sent From:**
        __${server?.name}__

        **Message ID:**
        __${target.id}__
        
        **Sent In (Hub):**
        __${networkMessage.hub?.name}__

        **Message Created:**
        <t:${Math.floor(target.createdTimestamp / 1000)}:R>
      `)
      .setColor('Random');

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('messageInfo')
        .setLabel('Message Info')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('serverInfo')
        .setLabel('Server Info')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('userInfo')
        .setLabel('User Info')
        .setStyle(ButtonStyle.Secondary),
    );

    const reportButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('report')
        .setLabel('Report')
        .setStyle(ButtonStyle.Danger),
    );

    const replyMsg = await interaction.reply({
      embeds: [embed],
      components: [buttons, reportButton],
      ephemeral: true,
    });

    // create a variable to store the profile card buffer
    let customCard: AttachmentBuilder | null = null;

    const collector = replyMsg?.createMessageComponentCollector({ idle: 30_000 });
    collector.on('collect', async i => {
      if (i.customId === 'serverInfo') {
        if (!server) {
          i.update({ content: 'Unable to find server!', embeds: [] });
          return;
        }

        const owner = await server.fetchOwner();
        const createdAt = Math.round(server.createdTimestamp / 1000);
        const guildSetup = await db.connectedList.findFirst({ where: { serverId: networkMessage.serverId } });

        const serverEmbed = new EmbedBuilder()
          .setColor(constants.colors.invisible)
          .setThumbnail(server.iconURL())
          .setImage(server.bannerURL())
          .setDescription(stripIndents`
          ## ${server?.name}
          ${server.description || 'No Description.'}

          **Owner:** 
        __${owner.user.username}__${owner.user.discriminator !== '0' ? `#${owner.user.discriminator}` : ''} ${owner.user.bot ? '(Bot)' : ''}

          **Created:** 
          <t:${createdAt}:d> (<t:${createdAt}:R>)

          **Member Count:** 
          __${server.memberCount}__

          **Invite:**
          __${guildSetup?.invite ? `[\`${guildSetup.invite}\`](https://discord.gg/${guildSetup.invite})` : 'Not Set.'}__`)
          .setFooter({ text: `ID: ${server.id}` });

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        const newButtons = ActionRowBuilder.from<ButtonBuilder>(buttons);
        newButtons.components[0].setDisabled(false);
        newButtons.components[1].setDisabled(true);
        components.push(newButtons);

        if (guildSetup?.invite) {
          components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.gg/${guildSetup?.invite}`)
              .setEmoji(emojis.icons.join)
              .setLabel('Join')),
          );
        }

        await i.update({ embeds: [serverEmbed], components, files: [] });
      }


      else if (i.customId === 'userInfo') {
        await i.deferUpdate();

        const createdAt = Math.round(author.createdTimestamp / 1000);

        const userEmbed = new EmbedBuilder()
          .setThumbnail(author.displayAvatarURL())
          .setColor('Random')
          .setImage(author.bannerURL() ?? null)
          .setDescription(stripIndents`
            ## ${author.username}${author.discriminator !== '0' ? `#${author.discriminator}` : ''} ${author.bot ? '(Bot)' : ''}

            **ID:**
            __${author.id}__

            **Created:**
            <t:${createdAt}:d> (<t:${createdAt}:R>)
            
            **Display Name:**
            __${author.globalName || 'Not Set.'}__

            **Hubs Owned:**
            __${await db.hubs.count({ where: { ownerId: author.id } })}__
          `)
          .setImage('attachment://customCard.png') // link to image that will be generated afterwards
          .setTimestamp();

        // disable the user info button
        const newButtons = ActionRowBuilder.from<ButtonBuilder>(buttons);
        newButtons.components[0].setDisabled(false);
        newButtons.components[2].setDisabled(true);

        // generate the profile card
        if (!customCard) customCard = new AttachmentBuilder(await profileImage(author.id), { name: 'customCard.png' });

        await i.editReply({
          embeds: [userEmbed],
          files: [customCard],
          components: [newButtons],
        });
      }


      else if (i.customId === 'messageInfo') {
        await i.update({ embeds: [embed], components: [buttons], files: [] });
      }


      else if (i.customId === 'report') {
        if (networkMessage.authorId === i.user.id) {
          i.reply({ content: 'You cannot report yourself!', ephemeral: true });
          return;
        }

        const reportsChannel = await i.client.channels.fetch(constants.channel.reports) as GuildTextBasedChannel;
        const reportedUser = await i.client.users.fetch(networkMessage.authorId);

        // network channelId in chatbot hq
        const cbhqJumpMsg = networkMessage.channelAndMessageIds.find((x) => x.channelId === '821607665687330816');

        const confirmEmbed = new EmbedBuilder()
          .setTitle('Report Type')
          .setDescription('Thank you for submitting a report. In order for our staff team to investigate, please specify the reason for your report. If you are reporting a server or bug, please use the /support report command instead.')
          .setFooter({ text: 'Submitting false reports will result in a warning.' })
          .setColor(constants.colors.interchatBlue);

        const typeSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('type')
            .setPlaceholder('Choose a report type.')
            .setMaxValues(2)
            .addOptions([
              new StringSelectMenuOptionBuilder()
                .setLabel('Harassment')
                .setDescription('Verbal or written abuse or threats.')
                .setValue('Harassment'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Bullying')
                .setDescription('Repeated aggressive behavior that is intended to harm, intimidate, or control another person.')
                .setValue('Bullying'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Toxicity')
                .setDescription('Hate speech, discrimination, or offensive language.')
                .setValue('Toxicity'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Spamming')
                .setDescription('Repeated unwanted messages or links in chat.')
                .setValue('Spamming'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Scamming')
                .setDescription('Fraud or deceitful behavior.')
                .setValue('Scamming'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Impersonation')
                .setDescription('Pretending to be someone else.')
                .setValue('Impersonation'),
              new StringSelectMenuOptionBuilder()
                .setLabel('NSFW Content')
                .setDescription('Inappropriate or offensive content.')
                .setValue('NSFW'),
            ]),
        );

        const message = await i.reply({
          embeds: [confirmEmbed],
          components: [typeSelect],
          ephemeral: true,
          fetchReply: true,
        });

        const selectCollector = message.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          idle: 60_000,
          max: 1,
        });

        selectCollector.on('collect', async (selInterac) => {
          const selections = selInterac.values;

          const modal = new ModalBuilder()
            .setCustomId(i.id)
            .setTitle('Report')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setRequired(false)
                  .setCustomId('reason')
                  .setStyle(TextInputStyle.Paragraph)
                  .setLabel('Additional Details (OPTIONAL)')
                  .setMaxLength(2000),
              ),
            );

          await selInterac.showModal(modal);

          selInterac.awaitModalSubmit({ time: 60_000 * 5 })
            .then(async (modalSubmit) => {
              await modalSubmit.deferUpdate();

              const reason = modalSubmit.fields.getTextInputValue('reason');

              const reportEmbed = new EmbedBuilder()
                .setTitle('User Reported')
                .setDescription(`A new user report for \`@${reportedUser.username}\` (${reportedUser.id}) was submitted.\n\n**Reported For:** ${selections.join(', ')}`)
                .setColor(constants.colors.interchatBlue)
                .setTimestamp()
                .setFooter({
                  text: `Reported By: ${modalSubmit.user.username} | ${modalSubmit.user.id}.`,
                  iconURL: modalSubmit.user.avatarURL() || modalSubmit.user.defaultAvatarURL,
                });

              if (reason) reportEmbed.addFields({ name: 'Additional Details', value: reason });

              const jumpButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setLabel('Jump')
                  .setURL(`https://discord.com/channels/${constants.guilds.cbhq}/${cbhqJumpMsg?.channelId}/${cbhqJumpMsg?.messageId}`)
                  .setStyle(ButtonStyle.Link),
              );

              await reportsChannel?.send({
                embeds: [reportEmbed],
                components: [jumpButton],
              });

              await i.editReply({
                content: `${emojis.normal.yes} Your report has been successfully submitted! Join the support server to check the status of your report.`,
                embeds: [],
                components: [],
              });
            })
            .catch((e) => {
              if (!e.message.includes('with reason: time')) {
                logger.error(e);
                captureException(e);

                i.followUp({
                  content: `${emojis.normal.no} An error occored while making the report.`,
                  ephemeral: true,
                });
              }
              return null;
            });
        });
      }
    });
  },
};