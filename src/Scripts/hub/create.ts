import { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, EmbedBuilder, ActionRowBuilder, TextInputStyle, Collection } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

const cooldowns = new Collection<string, number>();

export async function execute(interaction: ChatInputCommandInteraction) {
  const commandInCooldown = cooldowns.get(interaction.user.id);
  if (commandInCooldown && commandInCooldown > Date.now()) {
    return await interaction.reply({
      content: `You may create another hub <t:${Math.round(commandInCooldown / 1000)}:R>.`,
      ephemeral: true,
    });
  }
  if (!interaction.inCachedGuild()) return;

  const hubName = interaction.options.getString('name', true);
  const iconUrl = interaction.options.getString('icon', true);
  const bannerUrl = interaction.options.getString('banner');

  const imgurRegex = /\bhttps?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:jpg|jpeg|gif|png|bmp)\b/g;

  const imgurIcons = iconUrl.match(imgurRegex);
  const imgurBanners = bannerUrl?.match(imgurRegex);

  if (!imgurIcons || imgurBanners === null) {
    return await interaction.reply({
      content: 'Please provide a valid Imgur link for the icon and banner. It should start with `https://i.imgur.com/` and end with an image extension.',
      ephemeral: true,
    });
  }

  const db = getDb();
  const hubs = await db.hubs.findMany({ where: { OR: [{ ownerId: interaction.user.id }, { name: hubName }] } });

  if (hubs.find(hub => hub.name === hubName)) {
    return await interaction.reply({
      content: `Sorry, name **${hubName}** is unavailable! Please choose another name.`,
      ephemeral: true,
    });
  }

  else if (hubs.reduce((acc, hub) => hub.ownerId === interaction.user.id ? acc + 1 : acc, 0) >= 3) {
    return await interaction.reply({
      content: 'You may only create a maximum of **3** hubs at the moment. Please delete one of your existing hubs before creating a new one.',
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
      // new ActionRowBuilder<TextInputBuilder>().addComponents(
      //   new TextInputBuilder()
      //     .setLabel('Language')
      //     .setPlaceholder('Pick the language of the hub.')
      //     .setStyle(TextInputStyle.Short)
      //     .setCustomId('language'),
      // ),
    );

  await interaction.showModal(modal);

  interaction.awaitModalSubmit({ time: 60 * 5000 })
    .then(async submitIntr => {
      const description = submitIntr.fields.getTextInputValue('description');
      const tags = submitIntr.fields.getTextInputValue('tags');

      // FIXME: settings is a required field, add the fields to every collection
      // in prod db before pushing it
      await db.hubs.create({
        data: {
          name: hubName,
          description,
          private: true,
          tags: tags.replaceAll(', ', ',').split(',', 5),
          ownerId: submitIntr.user.id,
          iconUrl: imgurIcons[0],
          bannerUrl: imgurBanners?.[0],
          settings: {},
        },
      });

      // FIXME this is a temp cooldown until we have a global cooldown system for commands & subcommands
      cooldowns.set(interaction.user.id, Date.now() + 60 * 60 * 1000);
      const successEmbed = new EmbedBuilder()
        .setTitle('Hub created!')
        .setColor('Green')
        .addFields({
          name: 'How to join this hub?',
          value: 'Use `/hub invite create` to generate an invite code to this hub. Servers with the code can connect using `/hub join` to connect to this hub.',
        },
        {
          name: 'How to make this hub public?',
          value: 'Use `/hub manage` to make your hub public and also edit other useful hub settings.',
        },
        )
        .setFooter({ text: 'Join the support server for help!' })
        .setTimestamp();

      await submitIntr.reply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    });
}
