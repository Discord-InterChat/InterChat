import { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, EmbedBuilder, ActionRowBuilder, TextInputStyle, Collection } from 'discord.js';
import { getDb } from '../../Utils/utils';
import { HubSettingsBits } from '../../Utils/hubSettingsBitfield';
import { stripIndents } from 'common-tags';

const cooldowns = new Collection<string, number>();

export default {
  async execute(interaction: ChatInputCommandInteraction) {
    const commandInCooldown = cooldowns.get(interaction.user.id);
    if (commandInCooldown && commandInCooldown > Date.now()) {
      return await interaction.reply({
        content: `You may create another hub <t:${Math.round(commandInCooldown / 1000)}:R>.`,
        ephemeral: true,
      });
    }
    if (!interaction.inCachedGuild()) return;

    const hubName = interaction.options.getString('name', true);
    const iconUrl = interaction.options.getString('icon');
    const bannerUrl = interaction.options.getString('banner');

    const imgurRegex = /\bhttps?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:jpg|jpeg|gif|png|bmp)\b/g;

    const imgurIcons = iconUrl?.match(imgurRegex);
    const imgurBanners = bannerUrl?.match(imgurRegex);

    if (imgurIcons === null || imgurBanners === null) {
      return await interaction.reply({
        content: 'Please provide a valid Imgur link for the icon and banner. It should start with `https://i.imgur.com/` and end with an image extension.',
        ephemeral: true,
      });
    }

    // if hubName contains "discord", "clyde" "```" then return
    if (hubName.match(/discord|clyde|```/gi)) {
      return await interaction.reply({
        content: 'Hub name can not contain `discord`, `clyde` or \\`\\`\\` . Please choose another name.',
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
        await submitIntr.deferReply({ ephemeral: true });

        const description = submitIntr.fields.getTextInputValue('description');

        await db.hubs.create({
          data: {
            name: hubName,
            description,
            private: true,
            ownerId: submitIntr.user.id,
            iconUrl: imgurIcons?.at(0) ?? interaction.client.user.displayAvatarURL(),
            bannerUrl: imgurBanners?.[0],
            settings: HubSettingsBits.SpamFilter | HubSettingsBits.Reactions,
          },
        });

        // FIXME this is a temp cooldown until we have a global cooldown system for commands & subcommands
        cooldowns.set(interaction.user.id, Date.now() + 60 * 60 * 1000);
        const successEmbed = new EmbedBuilder()
          .setColor('Green')
          .setDescription(stripIndents`
          ### Hub Created!

          Congratulations! Your private hub, **${hubName}**, has been successfully created.
          To join, create an invite using \`/hub invite create\` and share the generated code. Then join using \`/hub join\`.
          
          - **Generate invite:** \`/hub invite create\`
          - **Go public:** \`/hub manage\`
          - **Join hub:** \`/hub join\`
          - **Edit hub:** \`/hub manage\`
          - **Add moderators:** \`/hub moderator add\`
          
          __Learn more about hubs in our [guide](https://discord-interchat.github.io/docs).__
        `)

          .setFooter({ text: 'Join the support server for help!' })
          .setTimestamp();

        await submitIntr.editReply({ embeds: [successEmbed] });
      });
  },
};