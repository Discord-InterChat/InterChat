import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';
import { stripIndents } from 'common-tags';
import logger from '../../Utils/logger';

export default {
  developer: true,
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Announce something to the network!')
    .setDefaultMemberPermissions('0'),
  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder().setCustomId(`submit_${interaction.user.id}`).setTitle('Enter JSON value').addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('input')
          .setLabel('Input')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(stripIndents`
            {
              "content": "Hello World!"
            }
          `)
          .setPlaceholder('Any valid messageCreateOption is allowed. Make sure it is in valid JSON format.'),
      ),
    );

    await interaction.showModal(modal);

    interaction.awaitModalSubmit({
      time: 60_000,
    }).then(async (i) => {
      const rawInput = i.fields.getTextInputValue('input');
      let parsedInput;

      try {
        const preview = await i.channel?.send('This is the preview.');
        parsedInput = JSON.parse(rawInput);
        await preview?.edit(parsedInput);
      }
      catch (e) {
        return i.reply({ content: `Invalid JSON provided.\n\`\`\`${e}\`\`\``, ephemeral: true });
      }
      await interaction.client.sendInNetwork(parsedInput);
      i.reply('Message announced to the network!');
    }).catch((err) => !err.message.includes('reason: time') ? logger.error('[announce_err]:', err) : null);
  },
};
