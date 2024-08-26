import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { deleteHubs, setComponentExpiry, simpleEmbed } from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import Hub from './index.js';

export default class Delete extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({ where: { name: hubName } });
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (interaction.user.id !== hubInDb?.ownerId) {
      await interaction.reply({
        content: t({ phrase: 'hub.delete.ownerOnly', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const confirmEmbed = new EmbedBuilder()
      .setDescription(t({ phrase: 'hub.delete.confirm', locale }, { hub: hubInDb.name }))
      .setColor('Red');
    const confirmButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Confirm')
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_delete', 'confirm')
            .addArgs(interaction.user.id)
            .addArgs(hubInDb.id)
            .toString(),
        )
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setLabel('Cancel')
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_delete', 'cancel')
            .addArgs(interaction.user.id)
            .addArgs(hubInDb.id)
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

  @RegisterInteractionHandler('hub_delete')
  override async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, hubId] = customId.args;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (interaction.user.id !== userId) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.delete.ownerOnly', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    if (customId.suffix === 'cancel') {
      await interaction.update({
        embeds: [simpleEmbed(t({ phrase: 'hub.delete.cancelled', locale }, { emoji: emojis.no }))],
        components: [],
      });
      return;
    }

    await interaction.update({
      embeds: [simpleEmbed(t({ phrase: 'misc.loading', locale }, { emoji: emojis.loading }))],
      components: [],
    });

    const hubInDb = await db.hubs.findFirst({
      where: { id: hubId, ownerId: interaction.user.id },
    });
    if (!hubInDb) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.unknown', locale },
              { support_invite: Constants.Links.SupportInvite, emoji: emojis.no },
            ),
          ),
        ],
      });
      return;
    }

    await deleteHubs([hubInDb.id]);

    await interaction.editReply({
      embeds: [
        simpleEmbed(
          t({ phrase: 'hub.delete.success', locale }, { emoji: emojis.tick, hub: hubInDb.name }),
          { color: 'Green' },
        ),
      ],
    });
  }
}
