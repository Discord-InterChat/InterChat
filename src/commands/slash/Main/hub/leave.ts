import {
  ChatInputCommandInteraction,
  CacheType,
  MessageComponentInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { emojis } from '../../../../utils/Constants.js';
import { simpleEmbed, setComponentExpiry } from '../../../../utils/Utils.js';
import { t } from '../../../../utils/Locale.js';

export default class Leave extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.options.getString('hub', true);
    const isChannelConnected = await db.connectedList.findFirst({
      where: { channelId },
      include: { hub: true },
    });

    if (!isChannelConnected) {
      return await interaction.editReply({
        embeds: [
          simpleEmbed(
            t({ phrase: 'hub.leave.noHub', locale: interaction.user.locale }, { emoji: emojis.no }),
          ),
        ],
      });
    }
    else if (!interaction.member.permissions.has('ManageChannels', true)) {
      return await interaction.editReply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.missingPermissions', locale: interaction.user.locale },
              { permissions: 'Manage Channels', emoji: emojis.no },
            ),
          ),
        ],
      });
    }

    const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(
          new CustomID('hub_leave:yes', [channelId, isChannelConnected.hubId]).toString(),
        )
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(new CustomID('hub_leave:no', [channelId, isChannelConnected.hubId]).toString())
        .setLabel('No')
        .setStyle(ButtonStyle.Danger),
    ]);

    const resetConfirmEmbed = new EmbedBuilder()
      .setDescription(
        t(
          { phrase: 'hub.leave.confirm', locale: interaction.user.locale },
          { channel: `<#${channelId}>`, hub: `${isChannelConnected.hub?.name}` },
        ),
      )
      .setColor('Red')
      .setFooter({
        text: t({ phrase: 'hub.leave.confirmFooter', locale: interaction.user.locale }),
      });

    const reply = await interaction.editReply({
      embeds: [resetConfirmEmbed],
      components: [choiceButtons],
    });

    setComponentExpiry(interaction.client.getScheduler(), reply, 10_000);
  }

  @RegisterInteractionHandler('hub_leave')
  static override async handleComponents(interaction: MessageComponentInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args[0];
    const { locale } = interaction.user;

    if (customId.suffix === 'no') {
      await interaction.message.delete();
      return;
    }

    const validConnection = await db.connectedList.findFirst({ where: { channelId } });
    if (!validConnection) {
      await interaction.update({
        content: t({ phrase: 'connection.notFound', locale }, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
      return;
    }

    await db.connectedList.delete({ where: { channelId } });
    await interaction.update({
      content: t(
        { phrase: 'hub.leave.success', locale },
        { channel: `<#${channelId}>`, emoji: emojis.yes },
      ),
      embeds: [],
      components: [],
    });

    // log server leave
    if (interaction.guild) {
      const hubId = customId.args[1];
      await interaction.client.joinLeaveLogger.logServerLeave(hubId, interaction.guild);
    }
  }
}
