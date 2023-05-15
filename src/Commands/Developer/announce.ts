import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../../Utils/logger';

export default {
  developer: true,
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Announce something to the network! (Developer only)')
    .addStringOption((option) => option
      .setName('title')
      .setDescription('The title of the announcement.')
      .setRequired(true),
    )
    .addAttachmentOption((option) => option
      .setName('image')
      .setDescription('The image to attach to the announcement.'),
    )
    .addAttachmentOption((option) => option
      .setName('thumbnail')
      .setDescription('The image to attach to the announcement.'),
    )
    .setDefaultMemberPermissions('0'),
  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId(`submit_${interaction.id}`)
      .setTitle('Enter JSON value')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('input')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Announcing... something cool! lol'),
        ),
      );

    await interaction.showModal(modal);

    const embedTitle = interaction.options.getString('title', true);
    const image = interaction.options.getAttachment('image');
    const thumbnail = interaction.options.getAttachment('thumbnail');

    interaction
      .awaitModalSubmit({ time: 60_000 * 5 })
      .then(async (i) => {
        const rawInput = i.fields.getTextInputValue('input');
        const embed = new EmbedBuilder()
          .setTitle(embedTitle)
          .setImage(image ? image.url : null)
          .setThumbnail(thumbnail ? thumbnail.url : null)
          .setFooter({ text: 'This is an official announcement.', iconURL: 'https://cdn.discordapp.com/emojis/1035140306414342164.png' })
          .setDescription(rawInput)
          .setTimestamp()
          .setColor('Random');
        const confirmBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm')
            .setLabel('Announce')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger),
        );

        const confirmMsg = await i.reply({ content: 'This is the preview.', embeds: [embed], components: [confirmBtns] });
        const fetchedMsg = await confirmMsg.fetch();
        const confirmCollector = fetchedMsg.createMessageComponentCollector({ filter: (e) => e.user.id === i.user.id, time: 30_000 });

        confirmCollector.on('collect', async (btn) => {
          if (btn.customId === 'confirm') {
            // FIXME: Add option in the command for which hub to announce to...
            await interaction.client.sendInNetwork({ embeds: [embed] }, { name: 'InterChat Central Hub' });
            btn.reply('Message announced to the network!');
            return;
          }
          await btn.reply({ content: `${interaction.client.emotes.normal.no} Cancelled.` });
          i.editReply({ components: [] });
        });

      })
      .catch((err) =>
        !err.message.includes('reason: time') ? logger.error('[announce_err]:', err) : null,
      );
  },
};
