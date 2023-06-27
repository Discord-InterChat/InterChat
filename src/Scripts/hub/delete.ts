import { captureException } from '@sentry/node';
import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { deleteHubs, getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export async function execute(interaction: ChatInputCommandInteraction, hubName: string) {
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
        .setCustomId('confirm_delete')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setLabel('Cancel')
        .setCustomId('cancel_delete')
        .setStyle(ButtonStyle.Secondary),
    );

  const msg = await interaction.reply({
    embeds: [confirmEmbed],
    components: [confirmButtons],
  });

  const confirmation = await msg.awaitMessageComponent({
    filter: b => b.user.id === interaction.user.id,
    time: 30_000,
    componentType: ComponentType.Button,
  }).catch(() => null);

  if (!confirmation || confirmation.customId !== 'confirm_delete') {
    await msg.delete().catch(() => null);
    return;
  }

  await confirmation.update(`${interaction.client.emotes.normal.loading} Deleting connections, invites, messages and the hub. Please wait...`);

  try {
    await deleteHubs([hubInDb?.id]);
  }
  catch (e) {
    logger.error(e);
    captureException(e, {
      user: { id: interaction.user.id, username: interaction.user.tag },
      extra: { context: 'delete hub command', hubId: hubInDb?.id },
    });

    await confirmation.editReply('Something went wrong while trying to delete the hub. The developers have been notified.');
    return;
  }
  await confirmation.editReply({
    content:`${interaction.client.emotes.normal.tick} The hub has been successfully deleted.`,
    embeds: [],
    components: [],
  });
}