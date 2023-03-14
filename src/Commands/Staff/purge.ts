import { captureException } from '@sentry/node';
import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getAllNetworks } from '../../Structures/network';
import { getDb, toHuman } from '../../Utils/functions/utils';

export default {
  staff: true,
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Mass delete network messages. Staff-only')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Purge network messages sent from a particular server.')
        .addStringOption((opt) =>
          opt
            .setName('server')
            .setDescription('The ID of the server.')
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Number of messages to delete. Max: 100')
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Purge network messages sent by a particular user. Staff-only')
        .addStringOption(stringOption =>
          stringOption
            .setName('user')
            .setDescription('The ID of the user.')
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Number of messages to delete. Max: 100')
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .addSubcommand(
      subcommand =>
        subcommand
          .setName('replies')
          .setDescription('Purge messages from the network. Staff-only')
          .addStringOption(stringOption =>
            stringOption
              .setName('replies-to')
              .setDescription('Provide the message ID to delete its replies.')
              .setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName('limit')
              .setDescription('Number of messages to delete. Max: 100')
              .setMaxValue(100)
              .setRequired(false),
          ),
    )
    .addSubcommand(
      subcommand =>
        subcommand
          .setName('any')
          .setDescription('Purge messages from the network. Staff-only')
          .addIntegerOption((opt) =>
            opt
              .setName('limit')
              .setDescription('Number of messages to delete. Max: 100')
              .setMaxValue(100)
              .setRequired(true),
          ),
    )
    .addSubcommand(
      subcommand =>
        subcommand
          .setName('after')
          .setDescription('Purge messages after a certain message. Staff-only')
          .addStringOption(stringOption =>
            stringOption
              .setName('message')
              .setDescription('The ID of the starting message.')
              .setRequired(true),
          )
          .addIntegerOption((intOption) =>
            intOption
              .setName('limit')
              .setDescription('Number of messages to delete. Max: 100, Default: 10')
              .setRequired(false),
          ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const limit = interaction.options.getInteger('limit') || undefined;
    const emoji = interaction.client.emoji;
    const { messageData } = getDb();


    let messagesInDb;

    switch (subcommand) {
      case 'server': {
        const serverId = interaction.options.getString('server', true);
        messagesInDb = await messageData.findMany({ where: { serverId }, orderBy: { id: 'desc' }, take: limit });
        break;
      }

      case 'user': {
        const authorId = interaction.options.getString('user', true);
        messagesInDb = await messageData.findMany({ where: { authorId }, orderBy: { id: 'desc' }, take: limit });
        break;
      }
      case 'after': {
        const messageId = interaction.options.getString('message', true);
        const fetchedMsg = await messageData.findFirst({ where: { channelAndMessageIds: { some: { messageId } } } });
        if (fetchedMsg) {
          messagesInDb = await messageData.findMany({
            where: {
              timestamp: {
                gt: fetchedMsg.timestamp,
              },
            },
            orderBy: { id: 'asc' },
            take: limit,
          });
        }
        break;
      }

      case 'replies': {
        const messageId = interaction.options.getString('replies-to', true);
        messagesInDb = await messageData.findMany({ where: { reference: { is: { messageId } } }, take: limit });
        break;
      }


      case 'any':
        messagesInDb = await messageData.findMany({ orderBy: { id: 'desc' }, take: limit });
        break;

      default:
        break;
    }


    if (!messagesInDb || messagesInDb.length < 1) {
      return await interaction.reply({
        content: 'Unable to locate messages to purge in database. Maybe they have expired?',
        ephemeral: true,
      });
    }
    await interaction.reply({
      content: `${emoji.normal.loading} Purging...\n**Tip:** The \`Delete Message\` context menu is faster for smaller deletes.`,
      ephemeral: true,
    });

    let erroredMessageCount = 0;
    const deletedMessagesArr: string[][] = [];
    const startTime = performance.now();
    const allNetworks = await getAllNetworks();

    for (const network of allNetworks) {
      try {
        const channel = await interaction.client.channels.fetch(network.channelId);

        if (channel?.type === ChannelType.GuildText) {
          const messageIds = messagesInDb.flatMap((dbMsg) =>
            dbMsg.channelAndMessageIds
              .filter(({ channelId }) => channelId === channel.id)
              .map(({ messageId }) => messageId),
          );

          if (messageIds.length < 1) continue;

          await channel.bulkDelete(messageIds);
          deletedMessagesArr.push(messageIds);
        }
      }
      catch (e) {
        erroredMessageCount++;
        captureException(e);
        continue;
      }
    }

    const deletedMessages = deletedMessagesArr.flatMap((e) => e);
    const resultEmbed = new EmbedBuilder()
      .setTitle(`${emoji.icons.delete} Purge Results`)
      .setDescription(`Finished purging from **${allNetworks.length}** networks.`)
      .addFields([
        { name: 'Total Purged', value: `\`\`\`js\n${deletedMessages.length}\`\`\``, inline: true },
        { name: 'Errored Purges', value: `\`\`\`js\n${erroredMessageCount}\`\`\``, inline: true },
        { name: 'Avg. purged/network', value: `\`\`\`js\n${deletedMessagesArr[0].length}\`\`\``, inline: true },
        { name: 'Purge Limit', value: `\`\`\`js\n${limit}\`\`\``, inline: true },
        { name: 'Time Took', value: `\`\`\`elm\n${toHuman(performance.now() - startTime)}\`\`\``, inline: true },
      ])
      .setFooter({ text: `Purged By: ${interaction.user.tag}`, iconURL: interaction.user.avatarURL() || undefined })
      .setTimestamp()
      .setColor('Orange');

    interaction.followUp({ embeds: [resultEmbed] }).catch(captureException);

    // Remove the deleted messages from the database
    await messageData.deleteMany({
      where: { channelAndMessageIds: { some: { messageId: { in: deletedMessages } } } },
    });
  },
};