import {
  ChatInputCommandInteraction,
  CacheType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
} from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { LINKS, emojis } from '../../../../utils/Constants.js';
import { deleteHubs, simpleEmbed, setComponentExpiry } from '../../../../utils/Utils.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { t } from '../../../../utils/Locale.js';

export default class Delete extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({ where: { name: hubName } });

    if (interaction.user.id !== hubInDb?.ownerId) {
      return await interaction.reply({
        content: t({ phrase: 'errors.modUnownedHub', locale: interaction.user.locale }),
        ephemeral: true,
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setDescription(
        t(
          { phrase: 'hub.delete.confirm', locale: interaction.user.locale },
          { hub: hubInDb.name },
        ),
      )
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
  async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const userId = customId.args[0];
    const hubId = customId.args[1];

    if (interaction.user.id !== userId) {
      return await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.ownerOnly', locale: interaction.user.locale }))],
        ephemeral: true,
      });
    }

    if (customId.postfix === 'cancel') {
      await interaction.update({
        embeds: [simpleEmbed(t({ phrase: 'hub.delete.cancel', locale: interaction.user.locale }))],
        components: [],
      });
      return;
    }

    const hubInDb = await db.hubs.findFirst({
      where: { id: hubId, ownerId: interaction.user.id },
    });
    if (!hubInDb) {
      return await interaction.update({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.unknown', locale: interaction.user.locale },
              { support_invite: LINKS.SUPPORT_INVITE },
            ),
          ),
        ],
        components: [],
      });
    }

    await deleteHubs([hubInDb.id]);

    await interaction.update({
      embeds: [
        simpleEmbed(
          t(
            { phrase: 'hub.delete.success', locale: interaction.user.locale },
            { emoji: emojis.tick },
          ),
        ),
      ],
      components: [],
    });
  }
}
