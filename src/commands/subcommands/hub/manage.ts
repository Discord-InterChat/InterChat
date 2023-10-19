import {
  ActionRowBuilder,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import db from '../../../utils/Db.js';
import Hub from '../../slash/Main/hub.js';
import { hubs, connectedList } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { emojis } from '../../../utils/Constants.js';
import { Interaction } from '../../../decorators/Interaction.js';
import { CustomID } from '../../../structures/CustomID.js';
import { errorEmbed, setComponentExpiry } from '../../../utils/Utils.js';

export default class Manage extends Hub {
  async execute(interaction: ChatInputCommandInteraction) {
    // the chosen one heh
    const chosenHub = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({
      where: {
        name: chosenHub,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply(`${emojis.no} Hub not found.`);
      return;
    }

    await interaction.reply({
      embeds: [await Manage.hubEmbed(hubInDb)],
      components: [Manage.actionsSelect(hubInDb.name, interaction.user.id)],
    });

    // disable components after 5 minutes
    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 5000,
    );
  }

  @Interaction('hub_manage')
  async handleComponents(interaction: StringSelectMenuInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);

    if (customId.args[0] !== interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed('This dropdown is not for you!')],
        ephemeral: true,
      });
      return;
    }

    const hubInDb = await db.hubs.findFirst({
      where: { name: customId.args[1] },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({ content: 'This hub no longer exists!', ephemeral: true });
      return;
    }

    switch (interaction.values[0]) {
      case 'icon': {
        const modal = new ModalBuilder()
          .setCustomId(
            new CustomID()
              .setIdentifier('hub_manage_modal', 'icon')
              .addArgs(hubInDb.name)
              .toString(),
          )
          .setTitle('Change Hub Icon')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setLabel('Enter Icon URL')
                .setPlaceholder('Enter a valid imgur image URL.')
                .setStyle(TextInputStyle.Short)
                .setCustomId('icon'),
            ),
          );

        await interaction.showModal(modal);
        break;
      }

      case 'description': {
        const modal = new ModalBuilder()
          .setCustomId(
            new CustomID()
              .setIdentifier('hub_manage_modal', 'description')
              .addArgs(hubInDb.name)
              .toString(),
          )
          .setTitle('Edit Hub Description')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setLabel('Enter Description')
                .setPlaceholder('A detailed description about the hub.')
                .setMaxLength(1024)
                .setStyle(TextInputStyle.Paragraph)
                .setCustomId('description'),
            ),
          );

        await interaction.showModal(modal);
        break;
      }

      case 'banner': {
        const modal = new ModalBuilder()
          .setCustomId(
            new CustomID()
              .setIdentifier('hub_manage_modal', 'banner')
              .addArgs(hubInDb.name)
              .toString(),
          )
          .setTitle('Set Hub Banner')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setLabel('Enter Banner URL')
                .setPlaceholder('Enter a valid imgur image URL.')
                .setStyle(TextInputStyle.Short)
                .setCustomId('banner'),
            ),
          );

        await interaction.showModal(modal);
        break;
      }

      case 'visibility': {
        const updatedHub = await db.hubs.update({
          where: { id: hubInDb?.id },
          data: { private: !hubInDb?.private },
          include: { connections: true },
        });

        await interaction.reply({
          content: `Successfully set hub visibility to **${
            updatedHub?.private ? 'Private' : 'Public'
          }**.`,
          ephemeral: true,
        });

        await interaction.message
          .edit({ embeds: [await Manage.hubEmbed(updatedHub)] })
          .catch(() => null);
        break;
      }

      default:
        break;
    }
  }

  @Interaction('hub_manage_modal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const hubName = customId.args[0];

    let hubInDb = await db.hubs.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        content:
          'This hub no longer exists or you no longer have permissions to perform this action!',
        ephemeral: true,
      });
      return;
    }

    switch (customId.postfix) {
      // update description modal
      case 'description': {
        const description = interaction.fields.getTextInputValue('description');
        await db.hubs.update({
          where: { name: hubName },
          data: { description },
        });

        await interaction.reply({
          content: 'Successfully updated hub description.',
          ephemeral: true,
        });
        break;
      }

      // change icon modal
      case 'icon': {
        const newIcon = interaction.fields.getTextInputValue('icon');

        // check if icon is a valid imgur link
        const imgurLink = newIcon.match(
          /\bhttps?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:jpg|jpeg|gif|png|bmp)\b/g,
        );
        if (!imgurLink) {
          await interaction.reply({
            content: 'Invalid icon URL. Please make sure it is a valid imgur image URL.',
            ephemeral: true,
          });
          return;
        }

        await db.hubs.update({
          where: { name: hubName },
          data: { iconUrl: imgurLink[0] },
        });

        await interaction.reply({
          content: 'Successfully updated icon!',
          ephemeral: true,
        });
        break;
      }

      // change banner modal
      case 'banner': {
        const newBanner = interaction.fields.getTextInputValue('banner');
        const isImgurUrl = newBanner.match(
          /\bhttps?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:jpg|jpeg|gif|png|bmp)\b/g,
        );

        // if banner is not a valid imgur link
        if (!isImgurUrl) {
          await interaction.reply({
            content: 'Invalid banner URL. Please make sure it is a valid imgur image URL.',
            ephemeral: true,
          });
          return;
        }

        await db.hubs.update({
          where: { name: hubName },
          data: { bannerUrl: isImgurUrl[0] },
        });

        await interaction.reply({
          content: 'Successfully updated banner!',
          ephemeral: true,
        });
        break;
      }

      default:
        break;
    }

    // fetch updated data
    hubInDb = await db.hubs.findFirst({
      where: { name: hubName },
      include: { connections: true },
    });

    // update the original message with new embed
    if (hubInDb) {
      await interaction.message
        ?.edit({ embeds: [await Manage.hubEmbed(hubInDb)] })
        .catch(() => null);
    }
  }

  // utility methods
  static actionsSelect(hubName: string, userId: string) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_manage', 'actions')
            .addArgs(userId)
            .addArgs(hubName)
            .toString(),
        )
        .addOptions([
          {
            label: 'Edit Description',
            value: 'description',
            description: 'Edit the hub description.',
            emoji: '✏️',
          },
          {
            label: 'Toggle Visibility',
            value: 'visibility',
            description: 'Toggle the hub visibility between public and private.',
            emoji: '🔒',
          },
          {
            label: 'Set Icon',
            value: 'icon',
            description: 'Set the hub icon.',
            emoji: '🖼️',
          },
          {
            label: 'Set Banner',
            value: 'banner',
            description: 'Set the hub banner.',
            emoji: '🎨',
          },
        ]),
    );
  }

  static async hubEmbed(hub: hubs & { connections: connectedList[] }) {
    const hubBlacklistedUsers = await db.blacklistedUsers.count({
      where: { hubs: { some: { hubId: hub.id } } },
    });
    const hubBlacklistedServers = await db.blacklistedServers.count({
      where: { hubs: { some: { hubId: hub.id } } },
    });
    return new EmbedBuilder()
      .setTitle(hub.name)
      .setColor('Random')
      .setDescription(
        stripIndents`
      ${hub.description}
      - __**Public:**__ ${hub.private ? emojis.no : emojis.yes}
    `,
      )
      .setThumbnail(hub.iconUrl)
      .setImage(hub.bannerUrl)
      .addFields(
        {
          name: 'Blacklists',
          value: stripIndents`
        - Users: ${hubBlacklistedUsers}
        - Servers: ${hubBlacklistedServers}
        `,
          inline: true,
        },

        {
          name: 'Hub Stats',
          value: stripIndents`
        - Moderators: ${hub.moderators.length.toString()}
        - Connected: ${hub.connections.length}
        - Owner: <@${hub.ownerId}>
        `,
          inline: true,
        },
      );
  }
}
