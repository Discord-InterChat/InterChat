import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
} from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { LINKS, emojis } from '../../../../utils/Constants.js';
import {
  deleteHubs,
  simpleEmbed,
  setComponentExpiry,
  getUserLocale,
} from '../../../../utils/Utils.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { t } from '../../../../utils/Locale.js';

export default class Delete extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({ where: { name: hubName } });
    const locale = await getUserLocale(interaction.user.id);

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
  static override async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, hubId] = customId.args;
    const locale = await getUserLocale(interaction.user.id);

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
              { support_invite: LINKS.SUPPORT_INVITE, emoji: emojis.no },
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
