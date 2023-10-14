import { ChatInputCommandInteraction, CacheType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ButtonInteraction } from 'discord.js';
import db from '../../../utils/Db.js';
import HubCommand from '../../slash/Main/hub.js';
import { captureException } from '@sentry/node';
import { emojis } from '../../../utils/Constants.js';
import { setComponentExpiry } from '../../../utils/Utils.js';
import { CustomID } from '../../../structures/CustomID.js';
import { ComponentInteraction } from '../../../decorators/Interaction.js';

export default class Delete extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({ where: { name: hubName } });

    if (interaction.user.id !== hubInDb?.ownerId) {
      return await interaction.reply({
        content: `${emojis.info} Unable to find hub. Make sure you are the owner of the hub.`,
        ephemeral: true,
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('Are you sure?')
      .setDescription('Are you sure you want to delete this hub? This is a destructive action that will **delete all connections** along with the hub.')
      .setColor('Red');
    const confirmButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Confirm')
          .setCustomId(
            new CustomID()
              .setIdentifier('hub_delete', 'confirm')
              .addData(interaction.user.id)
              .addData(hubName)
              .toString(),
          )
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setLabel('Cancel')
          .setCustomId(
            new CustomID()
              .setIdentifier('hub_delete', 'cancel')
              .addData(interaction.user.id)
              .addData(hubName)
              .toString(),
          )
          .setStyle(ButtonStyle.Secondary),
      );

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmButtons],
    });

    setComponentExpiry(interaction.client.getScheduler(), await interaction.fetchReply(), 10_000);
  }

  @ComponentInteraction('hub_delete')
  async handleComponent(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const userId = customId.data[0];
    const hubName = customId.data[1];

    if (interaction.user.id !== userId) {
      return await interaction.reply({
        content: 'Only the hub owner can delete this hub.',
        ephemeral: true,
      });
    }

    if (customId.postfix === 'cancel') {
      await interaction.message.delete().catch(() => null);
      return;
    }

    const hubInDb = await db.hubs.findFirst({ where: { name: hubName, ownerId: interaction.user.id } });
    if (!hubInDb) {
      return await interaction.update({
        content: `Hub **${hubName}** no longer exists.`,
        embeds: [],
        components: [],
      });
    }

    await interaction.update(`${emojis.loading} Deleting connections, invites, messages and the hub. Please wait...`);

    try {
      await db.hubs.delete({ where: { id: hubInDb.id } });
    }
    catch (e) {
      captureException(e, { user: { id: interaction.user.id, username: interaction.user.username } });
      await interaction.editReply('Something went wrong while trying to delete the hub. The developers have been notified.');
      return;
    }

    await interaction.editReply({
      content:`${emojis.tick} The hub has been successfully deleted.`,
      embeds: [],
      components: [],
    });
  }
}