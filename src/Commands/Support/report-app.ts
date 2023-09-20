import { getDb, constants, colors } from '../../Utils/misc/utils';
import { ModalBuilder, ActionRowBuilder, EmbedBuilder, ContextMenuCommandBuilder, ApplicationCommandType, TextInputStyle, TextInputBuilder, MessageContextMenuCommandInteraction, GuildTextBasedChannel, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../../Utils/logger';
import { captureException } from '@sentry/node';

export default {
  description: 'Report a user directly from the Chat Network!',
  data: new ContextMenuCommandBuilder().setName('Report').setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    // The message the interaction is being performed on
    const target = interaction.targetMessage;

    const messageData = getDb().messageData;
    const messageInDb = await messageData?.findFirst({
      where: {
        channelAndMessageIds: {
          some: { messageId: { equals: target.id } },
        },
      },
    });

    // check if args.channel is in connectedList DB
    if (!messageInDb) {
      return await interaction.reply({
        content: 'This command only works on messages sent in the network. Please use `/support report` to report individual users/servers instead.',
        ephemeral: true,
      });
    }

    if (messageInDb.authorId === interaction.user.id) {
      return interaction.reply({ content: 'You cannot report yourself!', ephemeral: true });
    }

    const cbhq = await interaction.client.guilds.fetch(constants.guilds.cbhq);
    const reportsChannel = await cbhq.channels.fetch(constants.channel.reports) as GuildTextBasedChannel;
    const reportedUser = await interaction.client.users.fetch(messageInDb.authorId);

    // network channelId in chatbot hq
    const cbhqJumpMsg = messageInDb.channelAndMessageIds.find((x) => x.channelId === '821607665687330816');

    const emojis = interaction.client.emotes.normal;

    const confirmEmbed = new EmbedBuilder()
      .setTitle('Report Type')
      .setDescription('Thank you for submitting a report. In order for our staff team to investigate, please specify the reason for your report. If you are reporting a server or bug, please use the /support report command instead.')
      .setFooter({ text: 'Submitting false reports will result in a warning.' })
      .setColor(colors('chatbot'));

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

    const message = await interaction.reply({
      embeds: [confirmEmbed],
      components: [typeSelect],
      ephemeral: true,
    });

    const selectCollector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      idle: 60_000,
    });

    selectCollector.on('collect', async (i) => {
      const selections = i.values;

      const modal = new ModalBuilder()
        .setCustomId(interaction.id)
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

      await i.showModal(modal);

      i.awaitModalSubmit({ time: 60_000 * 5 })
        .then(async (modalSubmit) => {
          const reason = modalSubmit.fields.getTextInputValue('reason');

          const embed = new EmbedBuilder()
            .setTitle('User Reported')
            .setDescription(`A new user report for \`@${reportedUser.username}\` (${reportedUser.id}) was submitted.\n\n**Reported For:** ${selections.join(', ')}`)
            .setColor(colors('chatbot'))
            .setTimestamp()
            .setFooter({
              text: `Reported By: ${modalSubmit.user.username} | ${modalSubmit.user.id}.`,
              iconURL: modalSubmit.user.avatarURL() || modalSubmit.user.defaultAvatarURL,
            });

          if (reason) embed.addFields({ name: 'Additional Details', value: reason });

          const jumpButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Jump')
              .setURL(`https://discord.com/channels/${cbhq.id}/${cbhqJumpMsg?.channelId}/${cbhqJumpMsg?.messageId}`)
              .setStyle(ButtonStyle.Link),
          );

          await reportsChannel?.send({
            embeds: [embed],
            components: [jumpButton],
          });
          modalSubmit.reply({
            content: `${emojis.yes} Your report has been successfully submitted! Join the support server to check the status of your report.`,
            ephemeral: true,
          });
        })
        .catch((e) => {
          if (!e.message.includes('with reason: time')) {
            logger.error(e);
            captureException(e);
            interaction.followUp({
              content: `${emojis.no} An error occored while making the report.`,
              ephemeral: true,
            });
          }
        });
    });
  },
};
