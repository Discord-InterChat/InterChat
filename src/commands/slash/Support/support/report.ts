import {
  ActionRowBuilder,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ForumChannel,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import { stripIndents } from 'common-tags';
import { channels, colors, emojis } from '../../../../utils/Constants.js';
import Support from './index.js';
import { CustomID } from '../../../../structures/CustomID.js';
import { Interaction } from '../../../../decorators/Interaction.js';

export default class Report extends Support {
  static readonly reportModal = new ModalBuilder()
    .setTitle('New Report')
    .setCustomId(new CustomID().setIdentifier('report_modal').toString())
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

  async execute(interaction: ChatInputCommandInteraction) {
    const reportType = interaction.options.getString('type', true) as
      | 'user'
      | 'server'
      | 'bug'
      | 'other';

    if (reportType === 'bug') {
      const bugSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setMaxValues(2)
          .setCustomId(new CustomID().setIdentifier('report', 'bug').toString())
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

      await interaction.reply({
        embeds: [bugEmbed],
        components: [bugSelect],
        ephemeral: true,
      });
    }
    else if (reportType === 'server' || reportType === 'user' || reportType === 'other') {
      const modal = new ModalBuilder(Report.reportModal)
        .setCustomId(new CustomID().setIdentifier('report_modal', reportType).toString())
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('id')
              .setLabel('User/Server ID')
              .setPlaceholder('The IDs of the user/server you are reporting.')
              .setStyle(TextInputStyle.Short)
              .setMinLength(17)
              .setMaxLength(20),
          ),
        );

      await interaction.showModal(modal);
    }
  }

  @Interaction('report')
  async handleComponents(interaction: MessageComponentInteraction<CacheType>) {
    if (interaction.isStringSelectMenu()) {
      const modal = new ModalBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('report_modal', 'bug')
            .addArgs(interaction.values.join(', '))
            .toString(),
        )
        .setTitle('New Bug Report')
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('summary')
              .setLabel('Whats the bug about?')
              .setPlaceholder('Frequent interaction failures...')
              .setStyle(TextInputStyle.Short),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel('Detailed Description (OPTIONAL)')
              .setPlaceholder(
                'Please describe the steps to reproduce the issue, include any unexpected behavior.',
              )
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMinLength(17),
          ),
        );

      // show modal to collect extra information
      await interaction?.showModal(modal);
    }
  }

  @Interaction('report_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const affected = customId.args[0];
    const reportType = customId.args[0];

    if (reportType === 'bug') {
      const summary = interaction.fields.getTextInputValue('summary');
      const description = interaction.fields.getTextInputValue('description');

      const bugReportEmbed = new EmbedBuilder()
        .setColor(colors.invisible)
        .setTitle(summary)
        .setDescription(`**Affects:** ${affected}`)
        .setThumbnail(
          interaction.user.avatarURL({ size: 2048 }) ?? interaction.user.defaultAvatarURL,
        )
        .setFooter({
          text: `Reported by ${interaction.user.username} (${interaction.user.id})`,
          iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
        });

      if (description) bugReportEmbed.addFields({ name: 'Details', value: description });

      // send the bug report to ic central
      await interaction.client.cluster.broadcastEval(
        async (client, ctx) => {
          const bugReportChannel = (await client.channels
            .fetch(ctx.bugsChannel)
            .catch(() => null)) as ForumChannel | null;

          if (!bugReportChannel) return;

          const appliedTags = bugReportChannel.availableTags
            .map((tag) => {
              if (ctx.affected.includes(tag.name)) return tag.id;
            })
            .filter((tag) => tag !== undefined) as string[];

          // finally make the post in ic central
          await bugReportChannel.threads.create({
            name: summary,
            message: { embeds: [bugReportEmbed] },
            appliedTags,
          });
        },
        { context: { affected, bugsChannel: channels.bugs } },
      );

      await interaction.reply({
        content: `${emojis.yes} Successfully submitted report. Join the </support server:924659341049626636> to view and/or attach screenshots to it.`,
        ephemeral: true,
      });
    }
    else {
      const reportChannel = (await interaction.client.channels
        .fetch(channels.reports)
        .catch(() => null)) as ThreadChannel | null;

      const reportDescription = interaction.fields.getTextInputValue('description');

      switch (reportType) {
        case 'user': {
          const Ids = interaction.fields.getTextInputValue('id');
          const reportedUser = await interaction.client.users.fetch(Ids).catch(() => null);
          if (!reportedUser) {
            await interaction.reply({
              content: stripIndents`
                ${emojis.no} I couldn't find a user with that ID.\n\n
                **To find a user's ID within the network, please follow these instructions:**
                ${emojis.dotYellow} Right click on a message sent from the user in question select \`Apps > Message Info\`. Please double-check the ID and try again.
              `,
              ephemeral: true,
            });
            return;
          }

          const userReport = new EmbedBuilder()
            .setColor('Red')
            .setTitle('New User Report')
            .setDescription(`Username: ${reportedUser.username}\nUser Id: ${reportedUser.id}`)
            .setFields({ name: 'Reason for report', value: reportDescription })
            .setThumbnail(reportedUser.avatarURL({ size: 2048 }) ?? reportedUser.defaultAvatarURL)
            .setFooter({
              text: `Reported by ${interaction.user.username} (${interaction.user.id})`,
              iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
            });
          await reportChannel?.send({ content: '<@&1088677008260726854>', embeds: [userReport] });
          break;
        }

        case 'server': {
          const id = interaction.fields.getTextInputValue('id');
          const reportedServer = await interaction.client.fetchGuild(id).catch(() => null);
          if (!reportedServer) {
            await interaction.reply({
              content: stripIndents`
              ${emojis.no} I couldn't find a server with that ID.\n
              **To find a server ID within the network, please follow these instructions:**
              ${emojis.dotYellow}  Right click on a message sent by the server in question and select \`Apps > Message Info\`. Please double-check the ID and try again.
              `,
              ephemeral: true,
            });
            return;
          }

          const serverReport = new EmbedBuilder()
            .setColor('Red')
            .setTitle('New Server Report')
            .setDescription(
              `Server Name: ${reportedServer.name}\nServer Id: ${reportedServer.members}`,
            )
            .setFields({ name: 'Reason for report', value: reportDescription })
            .setThumbnail(
              `https://cdn.discordapp.com/icons/${reportedServer.id}/${reportedServer.icon}.png?size=2048`,
            )
            .setFooter({
              text: `Reported by ${interaction.user.username} (${interaction.user.id})`,
              iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
            });
          await reportChannel?.send({
            content: '<@&1088677008260726854>',
            embeds: [serverReport],
          });
          break;
        }
        default: {
          const otherReport = new EmbedBuilder()
            .setColor('Random')
            .setTitle('New Report')
            .setDescription('**Type:** Other')
            .setFields({ name: 'Description', value: reportDescription })
            .setFooter({
              text: `Reported by ${interaction.user.username} (${interaction.user.id})`,
              iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
            });
          await reportChannel?.send({
            content: '<@&1088677008260726854>',
            embeds: [otherReport],
          });
          break;
        }
      }
      await interaction.reply({
        content: 'Report submitted. Join the support server to get updates on your report.',
        ephemeral: true,
      });
    }
  }
}
