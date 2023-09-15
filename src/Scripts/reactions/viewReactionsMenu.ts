import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonInteraction, ComponentType, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import sortReactions from './sortReactions';
import updateMessageReactions from './updateMessage';

export default async function(interaction: ButtonInteraction) {
  const db = getDb();
  const target = interaction.message;
  const emotes = interaction.client.emotes.normal;
  const networkMessage = await db.messageData.findFirst({
    where: { channelAndMessageIds: { some: { messageId: target.id } } },
    include: { hub: { select: { connections: { where: { connected: true } } } } },
  });

  if (!networkMessage || !networkMessage.reactions || !networkMessage.hubId) {
    await interaction.reply({
      content: 'There are no more reactions to view.',
      ephemeral: true,
    });
    return;
  }

  const userBlacklisted = await db.blacklistedUsers.findFirst({
    where: { userId: interaction.user.id, hubId: networkMessage.hubId },
  });
  const serverBlacklisted = await db.blacklistedServers.findFirst({
    where: { serverId: interaction.guild?.id, hubId: networkMessage.hubId },
  });

  if (userBlacklisted || serverBlacklisted) {
    await interaction.reply({
      content: 'You are blacklisted from this hub.',
      ephemeral: true,
    });
    return;
  }

  const reactions = networkMessage.reactions?.valueOf() as Record<string, string[]>;
  const sortedReactions = sortReactions(reactions);
  let totalReactions = 0;
  let reactionString = '';
  const reactionMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('add_reaction')
      .setPlaceholder('Add a reaction'),
  );

  sortedReactions.forEach((r, index) => {
    if (r[1].length === 0 || index >= 10) return;
    reactionMenu.components[0].addOptions({
      label: 'React/Unreact',
      value: r[0],
      emoji: r[0],
    });
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

  const resp = await interaction.reply({
    embeds: [embed],
    components: [reactionMenu],
    ephemeral: true,
    fetchReply: true,
  });

  const collector = resp.createMessageComponentCollector({
    idle: 60_000,
    filter: (i) => i.user.id === interaction.user.id && i.customId === 'add_reaction',
    componentType: ComponentType.StringSelect,
  });

  collector.on('collect', async (i) => {
    const messageInDb = await db.messageData.findFirst({ where: { id: networkMessage.id } });
    if (!messageInDb || !messageInDb.reactions) return;

    const dbReactions = messageInDb.reactions.valueOf() as Record<string, string[]>;
    const reactedEmoji = i.values[0];
    if (!dbReactions[reactedEmoji]) return;

    // If the user already reacted, remove the reaction
    if (dbReactions[reactedEmoji].includes(interaction.user.id)) {
      const userIndex = dbReactions[reactedEmoji].indexOf(interaction.user.id);
      dbReactions[reactedEmoji].splice(userIndex, 1);
      await i.reply({
        content: `You have unreacted with ${reactedEmoji}`,
        ephemeral: true,
      });
    }
    // Add the user to the array
    else {
      dbReactions[reactedEmoji].push(interaction.user.id);
      await i.reply({
        content: `You have reacted with ${reactedEmoji}`,
        ephemeral: true,
      });
    }

    await db.messageData.update({
      where: { id: messageInDb.id },
      data: { reactions: dbReactions },
    });

    if (networkMessage.hub) {
      updateMessageReactions(networkMessage.hub.connections, messageInDb.channelAndMessageIds, dbReactions);
    }
  });
}