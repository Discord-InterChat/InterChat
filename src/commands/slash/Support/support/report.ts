import Support from './index.js';
import {
  ActionRowBuilder,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import { LINKS, channels, colors, emojis } from '../../../../utils/Constants.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { t } from '../../../../utils/Locale.js';

export default class Report extends Support {
  static readonly reportModal = new ModalBuilder()
    .setTitle(t({ phrase: 'report.modal.title', locale: 'en' }))
    .setCustomId(new CustomID().setIdentifier('report_modal').toString())
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel(t({ phrase: 'report.modal.other.label', locale: 'en' }))
          .setPlaceholder(t({ phrase: 'report.modal.other.placeholder', locale: 'en' }))
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
        .setTitle(t({ phrase: 'report.bug.affected', locale: interaction.user.locale }))
        .setDescription(t({ phrase: 'report.bug.description', locale: interaction.user.locale }))
        .setColor(colors.interchatBlue);

      await interaction.reply({
        embeds: [bugEmbed],
        components: [bugSelect],
        ephemeral: true,
      });
    }
    else if (reportType === 'server' || reportType === 'user' || reportType === 'other') {
      const modal = ModalBuilder.from(Report.reportModal.components[0])
        .setCustomId(new CustomID().setIdentifier('report_modal', reportType).toString())
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('id')
              .setLabel(
                t({ phrase: 'report.modal.userOrServer.label', locale: interaction.user.locale }),
              )
              .setPlaceholder(
                t({
                  phrase: 'report.modal.userOrServer.placeholder',
                  locale: interaction.user.locale,
                }),
              )
              .setStyle(TextInputStyle.Short)
              .setMinLength(17)
              .setMaxLength(20),
          ),
        );

      await interaction.showModal(modal);
    }
  }

  @RegisterInteractionHandler('report')
  async handleComponents(interaction: MessageComponentInteraction<CacheType>) {
    if (interaction.isStringSelectMenu()) {
      const modal = new ModalBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('report_modal', 'bug')
            .addArgs(interaction.values.join(', '))
            .toString(),
        )
        .setTitle(t({ phrase: 'report.bug.title', locale: interaction.user.locale }))
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('summary')
              .setLabel(
                t({ phrase: 'report.modal.bug.input1.label', locale: interaction.user.locale }),
              )
              .setPlaceholder(
                t({
                  phrase: 'report.modal.bug.input1.placeholder',
                  locale: interaction.user.locale,
                }),
              )
              .setStyle(TextInputStyle.Short),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel(
                t({ phrase: 'report.modal.bug.input2.label', locale: interaction.user.locale }),
              )
              .setPlaceholder(
                t({
                  phrase: 'report.modal.bug.input1.placeholder',
                  locale: interaction.user.locale,
                }),
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

  @RegisterInteractionHandler('report_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const affected = customId.args[0];
    const reportType = customId.postfix;

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
          const devChat = (await client.channels
            .fetch(ctx.devChannel)
            .catch(() => null)) as TextChannel | null;

          if (!devChat) return;

          // finally make the post in ic central
          await devChat.send({ embeds: [bugReportEmbed] });
        },
        { context: { affected, devChannel: channels.devChat } },
      );

      await interaction.reply({
        content: t(
          { phrase: 'report.bug.submitted', locale: interaction.user.locale },
          { emoji: emojis.yes },
        ),
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
              content: t(
                { phrase: 'report.serverOrUser.invalidUser', locale: interaction.user.locale },
                { dot: emojis.dotYellow },
              ),
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
              content: t(
                { phrase: 'report.serverOrUser.invalidUser', locale: interaction.user.locale },
                { dot: emojis.dotYellow },
              ),
              ephemeral: true,
            });
            return;
          }

          const serverReport = new EmbedBuilder()
            .setColor('Red')
            .setTitle('New Server Report')
            .setDescription(`Server Name: ${reportedServer.name}\nServer Id: ${reportedServer.id}`)
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
        content: t(
          { phrase: 'report.submitted', locale: interaction.user.locale },
          { support_invite: LINKS.SUPPORT_INVITE },
        ),
        ephemeral: true,
      });
    }
  }
}
