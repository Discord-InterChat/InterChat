import { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, EmbedBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) return;

  const hubName = interaction.options.getString('name', true);
  const icon = interaction.options.getAttachment('icon', true);
  const banner = interaction.options.getAttachment('banner');

  const db = getDb();
  const hubExists = await db.hubs.findFirst({ where: { name:  hubName } });

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

  interaction.awaitModalSubmit({ time: 60 * 5000 })
    .then(async submitIntr => {
      const description = submitIntr.fields.getTextInputValue('description');
      const tags = submitIntr.fields.getTextInputValue('tags');
      // const language = submitIntr.fields.getTextInputValue('language');

      const hubCreate = await db.hubs.create({
        data: {
          name: hubName,
          language: 'English',
          description,
          private: true,
          tags: tags.replaceAll(', ', ',').split(',', 5),
          owner: { serverId: interaction.guild.id, userId: submitIntr.user.id },
          iconUrl: icon.url,
          bannerUrl: banner?.url,
        },
      });


      const successEmbed = new EmbedBuilder()
        .setTitle('Hub created!')
        .setDescription('Your hub has been created! Servers can now join it with its ID.')
        .setColor('Green')
        .addFields({ name: 'How to join the hub?', value: `Use the \`/hub join id: ${hubCreate.id}\` command to join this hub.` })
        .setTimestamp();

      await submitIntr.reply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    });
}
