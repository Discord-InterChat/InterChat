import { ApplicationCommandType, ButtonInteraction, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import { stripIndents } from 'common-tags';
import sortReactions from '../../Scripts/reactions/sortReactions';

export default {
  description: 'View all reactions on this message!',
  data: new ContextMenuCommandBuilder()
    .setName('View Reactions')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction | ButtonInteraction) {
    const db = getDb();
    const target = interaction.isButton() ? interaction.message : interaction.targetMessage;
    const emotes = interaction.client.emotes.normal;
    const networkMessage = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target.id } } },
      include: { hub: true },
    });

    if (!networkMessage) {
      await interaction.reply({
        content: 'Information about this message is no longer available.',
        ephemeral: true,
      });
      return;
    }

    const reactions = networkMessage.reactions?.valueOf() as Record<string, string[]>;
    const sortedReactions = sortReactions(reactions);
    let totalReactions = 0;
    let reactionString = '';

    sortedReactions.forEach((r, index) => {
      if (r[1].length === 0 || index >= 10) return;
      totalReactions++;
      reactionString += `- ${r[0]}: ${r[1].length}\n`;
    });

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setDescription(stripIndents`
        ## ${emotes.clipart} Reactions

        ${reactionString || 'No reactions yet!'}

        **Total Reactions:**
        __${totalReactions}__
      `)
      .setColor('Random');

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};