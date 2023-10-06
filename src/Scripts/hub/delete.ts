import { captureException } from '@sentry/node';
import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { deleteHubs, getDb } from '../../Utils/utils';
import logger from '../../Utils/logger';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  async execute(interaction: ChatInputCommandInteraction, hubName: string) {
    const db = getDb();
    const hubInDb = await db.hubs.findFirst({ where: { name: hubName } });

    if (interaction.user.id !== hubInDb?.ownerId) {
      return await interaction.reply({
        content: 'Only the hub owner can delete this hub.',
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
          .setCustomId('confirm')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setLabel('Cancel')
          .setCustomId('cancel')
          .setStyle(ButtonStyle.Secondary),
      );

    const msg = await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmButtons],
    });

    const clicked = await msg.awaitMessageComponent({
      filter: b => b.user.id === interaction.user.id,
      time: 30_000,
      componentType: ComponentType.Button,
    }).catch(() => null);

    if (!clicked || clicked.customId === 'cancel') {
      await msg.delete().catch(() => null);
      return;
    }

    await clicked.update(`${emojis.normal.loading} Deleting connections, invites, messages and the hub. Please wait...`);

    try {
      await deleteHubs([hubInDb?.id]);
    }
    catch (e) {
      logger.error(e);
      captureException(e, {
        user: { id: interaction.user.id, username: interaction.user.username },
        extra: { context: 'delete hub command', hubId: hubInDb?.id },
      });

      await clicked.editReply('Something went wrong while trying to delete the hub. The developers have been notified.');
      return;
    }
    await clicked.editReply({
      content:`${emojis.normal.tick} The hub has been successfully deleted.`,
      embeds: [],
      components: [],
    });
  },
};