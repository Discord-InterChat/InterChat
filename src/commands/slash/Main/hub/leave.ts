import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { deleteConnection } from '#main/utils/ConnectedListUtils.js';
import { emojis } from '#main/config/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { logGuildLeaveToHub } from '#main/utils/HubLogger/JoinLeave.js';
import { t } from '#main/utils/Locale.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageComponentInteraction,
} from 'discord.js';
import HubCommand from './index.js';
import { setComponentExpiry } from '#main/utils/ComponentUtils.js';

export default class Leave extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.options.getString('hub', true);
    const isChannelConnected = await db.connectedList.findFirst({
      where: { channelId },
      include: { hub: true },
    });

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!isChannelConnected) {
      await this.replyEmbed(interaction, t('hub.leave.noHub', locale, { emoji: emojis.no }));
      return;
    }
    else if (!interaction.member.permissions.has('ManageChannels', true)) {
      await this.replyEmbed(
        interaction,
        t('errors.missingPermissions', locale, {
          permissions: 'Manage Channels',
          emoji: emojis.no,
        }),
      );
      return;
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
        t('hub.leave.confirm', locale, {
          channel: `<#${channelId}>`,
          hub: `${isChannelConnected.hub?.name}`,
        }),
      )
      .setColor('Red')
      .setFooter({
        text: t('hub.leave.confirmFooter', locale),
      });

    const reply = await interaction.editReply({
      embeds: [resetConfirmEmbed],
      components: [choiceButtons],
    });

    setComponentExpiry(interaction.client.getScheduler(), reply, 10_000);
  }

  @RegisterInteractionHandler('hub_leave')
  override async handleComponents(interaction: MessageComponentInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [channelId] = customId.args;

    if (customId.suffix === 'no') {
      await interaction.deferUpdate();
      await interaction.deleteReply();
      return;
    }

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const validConnection = await db.connectedList.findFirst({ where: { channelId } });
    if (!validConnection) {
      await interaction.update({
        content: t('connection.notFound', locale, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
      return;
    }

    await deleteConnection({ channelId });
    await interaction.update({
      content: t('hub.leave.success', locale, { channel: `<#${channelId}>`, emoji: emojis.yes }),
      embeds: [],
      components: [],
    });

    // log server leave
    if (interaction.guild) {
      const hubId = customId.args[1];
      await logGuildLeaveToHub(hubId, interaction.guild);
    }
  }
}
