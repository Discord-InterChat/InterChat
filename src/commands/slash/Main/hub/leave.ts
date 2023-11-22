import {
  ChatInputCommandInteraction,
  CacheType,
  MessageComponentInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import Hub from './index.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { emojis } from '../../../../utils/Constants.js';
import { errorEmbed, setComponentExpiry } from '../../../../utils/Utils.js';
import db from '../../../../utils/Db.js';

export default class Leave extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const channelId = interaction.options.getString('hub', true);
    const isChannelConnected = await db.connectedList.findFirst({ where: { channelId } });

    if (!interaction.inCachedGuild()) {
      return await interaction.reply({
        embeds: [errorEmbed(`${emojis.no} This command can only be run in a server.`)],
        ephemeral: true,
      });
    }
    else if (!isChannelConnected) {
      return await interaction.reply({
        embeds: [
          errorEmbed(`${emojis.no} The channel <#${channelId}> does not have any networks.`),
        ],
      });
    }
    else if (!interaction.member.permissions.has('ManageChannels', true)) {
      return await interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.no} You must have the \`Manage Channels\` permission in this server to leave a hub.`,
          ),
        ],
        ephemeral: true,
      });
    }

    const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(new CustomID('hub_leave:yes', [channelId]).toString())
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(new CustomID('hub_leave:no', [channelId]).toString())
        .setLabel('No')
        .setStyle(ButtonStyle.Danger),
    ]);

    const resetConfirmEmbed = new EmbedBuilder()
      .setTitle('Delete Network Connection')
      .setDescription(
        'Are you sure? You will have to rejoin the hub to use the network again! All previous connection data will be lost.',
      )
      .setColor('Red')
      .setFooter({ text: 'Confirm within the next 10 seconds.' });

    await interaction.reply({
      embeds: [resetConfirmEmbed],
      components: [choiceButtons],
      fetchReply: true,
    });

    setComponentExpiry(interaction.client.getScheduler(), await interaction.fetchReply(), 10_000);
  }

  @RegisterInteractionHandler('hub_leave')
  async handleComponents(interaction: MessageComponentInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args[0];

    if (customId.postfix === 'no') {
      await interaction.message.delete();
      return;
    }

    await db.connectedList.delete({ where: { channelId } });
    await interaction.update({
      content: `${emojis.yes} Deleted network connection from <#${channelId}> and left the hub!`,
      embeds: [],
      components: [],
    });
  }
}
