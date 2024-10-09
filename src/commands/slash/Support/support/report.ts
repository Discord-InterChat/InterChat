import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import Constants, { emojis } from '#main/config/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { t } from '#utils/Locale.js';
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
import Support from './index.js';

export default class Report extends Support {
  async execute(interaction: ChatInputCommandInteraction) {
    const reportType = interaction.options.getString('type', true) as
      | 'user'
      | 'server'
      | 'bug'
      | 'other';

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

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
        .setTitle(t('report.bug.affected', locale))
        .setDescription(t('report.bug.description', locale))
        .setColor(Constants.Colors.interchatBlue);

      await interaction.reply({
        embeds: [bugEmbed],
        components: [bugSelect],
        ephemeral: true,
      });
    }
    else {
      const modal = new ModalBuilder()
        .setTitle(t('report.modal.title', locale))
        .setCustomId(new CustomID().setIdentifier('report_modal', reportType).toString())
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel(t('report.modal.other.label', locale))
              .setPlaceholder(t('report.modal.other.placeholder', locale))
              .setStyle(TextInputStyle.Paragraph)
              .setMinLength(10)
              .setMaxLength(950),
          ),
        );

      if (reportType !== 'other') {
        const content = t('misc.reportOptionMoved', locale, {
          emoji: emojis.exclamation,
          support_invite: Constants.Links.SupportInvite,
        });

        await interaction.reply({ content, ephemeral: true });
        return;
      }

      await interaction.showModal(modal);
    }
  }

  @RegisterInteractionHandler('report')
  override async handleComponents(interaction: MessageComponentInteraction<CacheType>) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (interaction.isStringSelectMenu()) {
      const modal = new ModalBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('report_modal', 'bug')
            .addArgs(interaction.values.join(', '))
            .toString(),
        )
        .setTitle(t('report.bug.title', locale))
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('summary')
              .setLabel(t('report.modal.bug.input1.label', locale))
              .setPlaceholder(t('report.modal.bug.input1.placeholder', locale))
              .setStyle(TextInputStyle.Short),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel(t('report.modal.bug.input2.label', locale))
              .setPlaceholder(t('report.modal.bug.input1.placeholder', locale))
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
    const [affected] = customId.args;
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
        { context: { affected, devChannel: Constants.Channels.devChat, embed } },
      );
    };

    switch (reportType) {
      case 'bug': {
        const summary = interaction.fields.getTextInputValue('summary');
        const description = interaction.fields.getTextInputValue('description');

        const bugReportEmbed = new EmbedBuilder()
          .setColor(Constants.Colors.invisible)
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

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    await interaction.reply({
      content: t('report.submitted', locale, {
        emoji: emojis.yes,
        support_command: '</support server:924659341049626636>',
      }),
      ephemeral: true,
    });
  }
}
