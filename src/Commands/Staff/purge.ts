import { captureException } from '@sentry/node';
import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getDb, toHuman } from '../../Utils/misc/utils';

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
              .setMaxValue(100)
              .setRequired(false),
          ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const limit = interaction.options.getInteger('limit') || 100;
    const emoji = interaction.client.emotes;
    const { messageData, connectedList } = getDb();
    const channelInHub = await connectedList.findFirst({ where: { channelId: interaction.channelId, connected: true } });

    if (!channelInHub) {
      return await interaction.reply({
        content: 'This channel is not connected to a hub.',
        ephemeral: true,
      });
    }

    let messagesInDb;

    switch (subcommand) {
      case 'server': {
        const serverId = interaction.options.getString('server', true);
        messagesInDb = await messageData.findMany({
          where: { serverId, hubId: channelInHub.hubId },
          orderBy: { id: 'desc' },
          take: limit,
        });
        break;
      }

      case 'user': {
        const authorId = interaction.options.getString('user', true);
        messagesInDb = await messageData.findMany({
          where: { authorId, hubId: channelInHub.hubId },
          orderBy: { id: 'desc' },
          take: limit,
        });
        break;
      }
      case 'after': {
        const messageId = interaction.options.getString('message', true);
        const fetchedMsg = await interaction.channel?.messages.fetch(messageId).catch(() => null);
        if (fetchedMsg) {
          messagesInDb = await messageData.findMany({
            take: limit,
            where: {
              timestamp: { gt: fetchedMsg.createdAt },
            },
          });
        }
        break;
      }

      case 'replies': {
        const messageId = interaction.options.getString('replies-to', true);
        messagesInDb = await messageData.findMany({
          where: { hubId: channelInHub.hubId, reference: { is: { messageId } } },
          take: limit,
        });
        break;
      }


      case 'any':
        messagesInDb = await messageData.findMany({
          where: { hubId: channelInHub.hubId },
          orderBy: { id: 'desc' },
          take: limit,
        });
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
    const initialReply = await interaction.reply(`${emoji.normal.loading} Purging...`);

    let erroredMessageCount = 0;
    let deletedMessageCount = 0;
    const deletedMessagesArr: string[] = [];

    const startTime = performance.now();
    const allNetworks = await connectedList.findMany({ where: { hubId: channelInHub.hubId, connected: true } });
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
          deletedMessagesArr.push(messageIds[0]);
          deletedMessageCount += messageIds.length;
        }
      }
      catch (e) {
        erroredMessageCount++;
        captureException(e);
        continue;
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle(`${emoji.icons.delete} Purge Results`)
      .setDescription(`Finished purging from **${allNetworks.length}** networks in \`${toHuman(performance.now() - startTime)}\`.`)
      .addFields([
        { name: 'Total Purged', value: `\`\`\`js\n${deletedMessageCount}\`\`\``, inline: true },
        { name: 'Errored Purges', value: `\`\`\`js\n${erroredMessageCount}\`\`\``, inline: true },
        { name: 'Purge Limit', value: `\`\`\`js\n${limit || 'None'}\`\`\``, inline: true },
      ])
      .setFooter({ text: `Purged By: ${interaction.user.username}`, iconURL: interaction.user.avatarURL() || undefined })
      .setTimestamp()
      .setColor('Orange');

    initialReply.edit({ content: '', embeds: [resultEmbed] }).catch(captureException);

    // Remove the deleted messages from the database
    await messageData.deleteMany({
      where: { channelAndMessageIds: { some: { messageId: { in: deletedMessagesArr } } } },
    }).catch(captureException);
  },
};
