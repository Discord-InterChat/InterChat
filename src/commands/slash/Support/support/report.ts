import Support from './index.js';
import {
  APIEmbed,
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
} from 'discord.js';
import { LINKS, channels, colors, emojis } from '../../../../utils/Constants.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { t } from '../../../../utils/Locale.js';

export default class Report extends Support {
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
    } else {
      const modal = new ModalBuilder()
        .setTitle(t({ phrase: 'report.modal.title', locale: interaction.user.locale }))
        .setCustomId(new CustomID().setIdentifier('report_modal', reportType).toString())
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel(t({ phrase: 'report.modal.other.label', locale: interaction.user.locale }))
              .setPlaceholder(
                t({ phrase: 'report.modal.other.placeholder', locale: interaction.user.locale }),
              )
              .setStyle(TextInputStyle.Paragraph)
              .setMinLength(10)
              .setMaxLength(950),
          ),
        );

      if (reportType !== 'other') {
        const content = t(
          {
            phrase: 'misc.reportOptionMoved',
            locale: interaction.user.locale,
          },
          { emoji: emojis.exclamation, support_invite: LINKS.SUPPORT_INVITE },
        );

        await interaction.reply({ content, ephemeral: true });
        return;
      }

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
    const reportType = customId.suffix;
    const reportDescription = interaction.fields.getTextInputValue('description');

    const sendReport = async (embed: APIEmbed) => {
      await interaction.client.cluster.broadcastEval(
        async (client, ctx) => {
          const devChat = (await client.channels
            .fetch(ctx.devChannel)
            .catch(() => null)) as TextChannel | null;

          if (!devChat) return;

          // finally make the post in ic central
          await devChat.send({ embeds: [ctx.embed] });
        },
        { context: { affected, devChannel: channels.devChat, embed } },
      );
    };

    switch (reportType) {
      case 'bug': {
        const summary = interaction.fields.getTextInputValue('summary');
        const description = interaction.fields.getTextInputValue('description');

        const bugReportEmbed = new EmbedBuilder()
          .setColor(colors.invisible)
          .setTitle(summary)
          .setDescription(`**Affects:** ${affected}`)
          .setThumbnail(
            interaction.user.avatarURL({ size: 2048 }) ?? interaction.user.defaultAvatarURL,
          )
          .addFields(description ? [{ name: 'Details', value: description }] : [])
          .setFooter({
            text: `Reported by ${interaction.user.username} (${interaction.user.id})`,
            iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
          });

        await sendReport(bugReportEmbed.toJSON());
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

        await sendReport(otherReport.toJSON());
        break;
      }
    }
    await interaction.reply({
      content: t(
        { phrase: 'report.submitted', locale: interaction.user.locale },
        { emoji: emojis.yes, support_command: '</support server:924659341049626636>' },
      ),
      ephemeral: true,
    });
  }
}
