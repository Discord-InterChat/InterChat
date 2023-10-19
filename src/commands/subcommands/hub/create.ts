import {
  ChatInputCommandInteraction,
  CacheType,
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import Hub from '../../slash/Main/hub.js';
import db from '../../../utils/Db.js';
import { stripIndents } from 'common-tags';
import { Interaction } from '../../../decorators/Interaction.js';
import { HubSettingsBits } from '../../../utils/BitFields.js';
import { checkAndFetchImgurUrl, errorEmbed } from '../../../utils/Utils.js';
import { emojis } from '../../../utils/Constants.js';

export default class Create extends Hub {
  // TODO: readonly cooldown = 60 * 60 * 1000;

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const modal = new ModalBuilder()
      .setTitle('Create a hub')
      .setCustomId('hub_create_modal')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel('Name')
            .setPlaceholder('Give your hub a name.')
            .setMinLength(2)
            .setMaxLength(100)
            .setStyle(TextInputStyle.Short)
            .setCustomId('name'),
        ),
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
            .setLabel('Icon')
            .setPlaceholder('Set a custom icon for your hub. Must be a imgur link.')
            .setMaxLength(300)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setCustomId('icon'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel('Banner')
            .setPlaceholder('Set a custom banner for your hub. Must be a imgur link.')
            .setMaxLength(300)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setCustomId('banner'),
        ),
        // new ActionRowBuilder<TextInputBuilder>().addComponents(
        //   new TextInputBuilder()
        //     .setLabel('Language')
        //     .setPlaceholder('Pick a language for this hub.')
        //     .setStyle(TextInputStyle.Short)
        //     .setCustomId('language'),
        // ),
      );

    await interaction.showModal(modal);
  }

  @Interaction('hub_create_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.fields.getTextInputValue('name');
    const description = interaction.fields.getTextInputValue('description');
    const icon = interaction.fields.getTextInputValue('icon');
    const banner = interaction.fields.getTextInputValue('banner');

    // if hubName contains "discord", "clyde" "```" then return
    if (name.match(/discord|clyde|```/gi)) {
      return await interaction.followUp({
        content:
          'Hub name can not contain `discord`, `clyde` or \\`\\`\\` . Please choose another name.',
        ephemeral: true,
      });
    }

    const hubs = await db.hubs.findMany({
      where: { OR: [{ ownerId: interaction.user.id }, { name }] },
    });

    if (hubs.find((hub) => hub.name === name)) {
      return await interaction.followUp({
        content: `Sorry, name **${name}** is unavailable! Please choose another name.`,
        ephemeral: true,
      });
    }
    else if (
      hubs.reduce((acc, hub) => (hub.ownerId === interaction.user.id ? acc + 1 : acc), 0) >= 3
    ) {
      return await interaction.followUp({
        content:
          'You may only create a maximum of **3** hubs at the moment. Please delete one of your existing hubs before creating a new one.',
        ephemeral: true,
      });
    }

    const iconUrl = icon ? await checkAndFetchImgurUrl(icon) : undefined;
    const bannerUrl = banner ? await checkAndFetchImgurUrl(banner) : undefined;

    // TODO create a gif showing how to get imgur links
    if (iconUrl === false || bannerUrl === false) {
      return await interaction.followUp({
        embeds: [
          errorEmbed(
            `${emojis.no} Invalid icon or banner url. Make sure it is a valid imgur link and that it is not a gallery or album.`,
          ),
        ],
        ephemeral: true,
      });
    }

    await db.hubs.create({
      data: {
        name: name,
        description,
        private: true,
        ownerId: interaction.user.id,
        iconUrl: iconUrl ?? interaction.client.user.displayAvatarURL(),
        bannerUrl: bannerUrl || undefined,
        settings:
          HubSettingsBits.SpamFilter | HubSettingsBits.Reactions | HubSettingsBits.BlockNSFW,
      },
    });

    // FIXME this is a temp cooldown until we have a global cooldown system for commands & subcommands
    // cooldowns.set(interaction.user.id, Date.now() + );
    const successEmbed = new EmbedBuilder()
      .setColor('Green')
      .setDescription(
        stripIndents`
        ### Hub Created!

        Congratulations! Your private hub, **${name}**, has been successfully created.
        To join, create an invite using \`/hub invite create\` and share the generated code. Then join using \`/hub join\`.
        
        - **Generate invite:** \`/hub invite create\`
        - **Go public:** \`/hub manage\`
        - **Join hub:** \`/hub join\`
        - **Edit hub:** \`/hub manage\`
        - **Add moderators:** \`/hub moderator add\`
        
        __Learn more about hubs in our [guide](https://discord-interchat.github.io/docs).__
      `,
      )

      .setFooter({ text: 'Join the support server for help!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }
}
