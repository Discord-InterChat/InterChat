import { captureMessage } from '@sentry/node';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, EmbedBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ChatInputCommandInteraction, ForumChannel, TextChannel, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    const reportType = interaction.options.getString('type', true) as 'user' | 'server' | 'bug' | 'other';
    const reportModal = new ModalBuilder()
      .setTitle('New Report')
      .setCustomId(interaction.id)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Report Details')
            .setPlaceholder('A detailed description of the report.')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(950),
        ),
      );

    const emojis = interaction.client.emotes.normal;

    if (reportType === 'bug') {
      const bugSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setMaxValues(2)
            .setCustomId('component')
            .setOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('Commands')
                .setEmoji(emojis.slash)
                .setValue('Commands'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Network')
                .setEmoji(emojis.clipart)
                .setValue('Network'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Other (Specify)')
                .setEmoji('❓')
                .setValue('Other'),
            ),
        );

      const bugEmbed = new EmbedBuilder()
        .setTitle('Affected Components')
        .setDescription('Please choose what component of the bot you are facing issues with.')
        .setColor('Random');

      const message = await interaction.reply({
        embeds: [bugEmbed],
        components: [bugSelect],
        ephemeral: true,
      });

      // get selected bug type
      const typeSelection = await message.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30_000,
      }).catch(() => null);

      reportModal.setComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('summary')
            .setLabel('Whats the bug about?')
            .setPlaceholder('Frequent interaction failures...')
            .setStyle(TextInputStyle.Short)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Detailed Description (OPTIONAL)')
            .setPlaceholder('Please describe the steps to reproduce the issue, include any unexpected behavior.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMinLength(17),
        ));

      // show modal to collect extra information
      await typeSelection?.showModal(reportModal);

      // get modal input and post it to support server forum
      typeSelection?.awaitModalSubmit({
        time: 60_000 * 5,
        filter: (i) => i.customId === reportModal.data.custom_id,
      }).then(async (bugModal) => {
        const bugReportChannel = await bugModal.client.channels.fetch(constants.channel.bugs).catch(() => null) as ForumChannel | null;
        if (!bugReportChannel) {
          logger.error('Bug report channel not found.');
          captureMessage('Bug report channel not found.', { user: { id: bugModal.user.id, username: bugModal.user.tag }, extra: { command: 'Bug Report' } });
          return bugModal.reply({
            content: 'An error occured while sending your report. The developers have been notified!',
            ephemeral: true,
          });
        }

        const summary = bugModal.fields.getTextInputValue('summary');
        const description = bugModal.fields.getTextInputValue('description');

        const bugReportEmbed = new EmbedBuilder()
          .setColor(colors('invisible'))
          .setTitle(summary)
          .setDescription(`**Affects:** ${typeSelection.values.join(', ')}`)
          .setThumbnail(interaction.user.avatarURL({ size: 2048 }) ?? interaction.user.defaultAvatarURL)
          .setFooter({
            text: `Reported by ${interaction.user.tag} (${interaction.user.id})`,
            iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
          });

        if (description) bugReportEmbed.addFields({ name: 'Details', value: description });

        const appliedTags = typeSelection.values
          .map((value) => bugReportChannel.availableTags.find((tag) => tag.name.includes(value))?.id || 'error lmao');

        // finally make the post in ic central
        await bugReportChannel.threads.create({
          name: summary,
          message: { embeds: [bugReportEmbed] },
          appliedTags,
        });

        bugModal.reply({
          content: `${emojis.yes} Successfully submitted report. Join the </support server:924659341049626636> to view and/or attach screenshots to it.`,
          ephemeral: true,
        });
      }).catch((error) => {
        if (!error.message.includes('ending with reason: time')) logger.error(error);
      });
      return;
    }

    else if (reportType === 'server' || reportType === 'user') {
      reportModal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('id')
            .setLabel('User/Server ID')
            .setPlaceholder('The IDs of the user/server you are reporting.')
            .setStyle(TextInputStyle.Short)
            .setMinLength(17)
            .setMaxLength(20),
        ));
    }

    await interaction.showModal(reportModal);
    interaction.awaitModalSubmit({ time: 60000 * 5, filter: (i) => i.user.id === interaction.user.id && i.customId === reportModal.data.custom_id })
      .then(async modalInteraction => {
        const reportChannel = await modalInteraction.client.channels.fetch(constants.channel.reports).catch(() => null) as TextChannel | null;
        const reportDescription = modalInteraction.fields.getTextInputValue('description');

        switch (reportType) {
          case 'user': {
            const Ids = modalInteraction.fields.getTextInputValue('id');
            const reportedUser = await interaction.client.users.fetch(Ids).catch(() => null);
            if (!reportedUser) {
              return modalInteraction.reply({
                content: stripIndents`
                  ${emojis.no} I couldn't find a user with that ID.\n\n
                  **To find a user's ID within the network, please follow these instructions:**
                  ${emojis.dotYellow} Right click on a message sent from the user in question select \`Apps > User Info\`. Please double-check the ID and try again.
                `,
                ephemeral: true,
              });
            }

            const userReport = new EmbedBuilder()
              .setColor('Red')
              .setTitle('New User Report')
              .setDescription(`User Tag: ${reportedUser.tag}\nUser Id: ${reportedUser.id}`)
              .setFields({ name: 'Reason for report', value: reportDescription })
              .setThumbnail(reportedUser.avatarURL({ size: 2048 }) ?? reportedUser.defaultAvatarURL)
              .setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });
            await reportChannel?.send({ embeds: [userReport] });
            break;
          }

          case 'server': {
            const ids = modalInteraction.fields.getTextInputValue('id');
            const reportedServer = await interaction.client.guilds.fetch(ids).catch(() => null);
            if (!reportedServer) {
              return modalInteraction.reply({
                content: stripIndents`
                ${emojis.no} I couldn't find a server with that ID.\n
                **To find a server ID within the network, please follow these instructions:**
                ${emojis.dotYellow}  Right click on a message sent by the server in question and select \`Apps > Server Info\`. Please double-check the ID and try again.
                `,
                ephemeral: true,
              });
            }

            const serverReport = new EmbedBuilder()
              .setColor('Red')
              .setTitle('New Server Report')
              .setDescription(`Server Name: ${reportedServer.name}\nServer Id: ${reportedServer.id}`)
              .setFields({ name: 'Reason for report', value: reportDescription })
              .setThumbnail(reportedServer.iconURL({ size: 2048 }))
              .setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });
            await reportChannel?.send({ embeds: [serverReport] });
            break;
          }
          default: {
            const otherReport = new EmbedBuilder()
              .setColor('Random')
              .setTitle('New Report')
              .setDescription('**Type:** Other')
              .setFields({ name: 'Description', value: reportDescription })
              .setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });
            await reportChannel?.send({ embeds: [otherReport] });
            break;
          }
        }
        await modalInteraction.reply({ content: 'Report submitted. Join the support server to get updates on your report.', ephemeral: true });
      }).catch((error) => {if (!error.message.includes('ending with reason: time')) logger.error(error);});

  },
};
