import {
  APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import db from '../../../utils/Db.js';
import BaseCommand from '../../BaseCommand.js';
import { captureException } from '@sentry/node';
import { stripIndents } from 'common-tags';
import { emojis } from '../../../utils/Constants.js';
import { messageData as messageDataCol } from '@prisma/client';
import { errorEmbed, msToReadable } from '../../../utils/Utils.js';
import Logger from '../../../utils/Logger.js';

const limitOpt: APIApplicationCommandBasicOption = {
  type: ApplicationCommandOptionType.Integer,
  name: 'limit',
  description: 'Number of messages to delete. Max: 100',
  required: true,
  max_value: 100,
};

export default class Purge extends BaseCommand {
  readonly staffOnly = true;
  readonly cooldown = 10_000;
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'purge',
    description: 'Mass delete network messages. Staff-only',
    dm_permission: false,
    default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'server',
        description: 'Purge network messages sent from a particular server.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'server',
            description: 'The ID of the server.',
            required: true,
          },
          { ...limitOpt },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'user',
        description: 'Purge network messages sent by a particular user. Staff-only',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'user',
            description: 'The ID of the user.',
            required: true,
          },
          { ...limitOpt },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'replies',
        description: 'Purge messages from the network. Staff-only',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'replied-to',
            description: 'Provide the message ID to delete its replies.',
            required: true,
          },
          { ...limitOpt },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'any',
        description: 'Purge messages from the network. Staff-only',
        options: [{ ...limitOpt }],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'after',
        description: 'Purge messages after a certain message. Staff-only',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'message',
            description: 'The ID of the starting message.',
            required: true,
          },
          {
            type: ApplicationCommandOptionType.Integer,
            name: 'limit',
            description: 'Number of messages to delete. Max: 100, Default: 10',
            max_value: 100,
            required: false,
          },
        ],
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const limit = interaction.options.getInteger('limit') || 100;
    const { messageData, connectedList, hubs } = db;
    const channelInHub = await connectedList.findFirst({
      where: { channelId: interaction.channelId, connected: true },
    });

    const isMod = hubs.findFirst({ where: {
      OR: [
        { moderators: { some: { userId: interaction.user.id } } },
        { ownerId: interaction.user.id },
      ],
    } });

    if (!isMod) {
      return await interaction.reply({
        embeds: [errorEmbed(`${emojis.no} You must be a moderator or owner of this hub to use this command.`)],
        ephemeral: true,
      });
    }


    if (!channelInHub) {
      return await interaction.reply({
        content: 'This channel is not connected to a hub.',
        ephemeral: true,
      });
    }

    let messagesInDb: messageDataCol[] = [];

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
        const messageId = interaction.options.getString('replied-to', true);
        const originalMsg = await messageData.findFirst({
          where: { channelAndMessageIds: { some: { messageId } } },
        });


        messagesInDb = originalMsg
          ? await messageData.findMany({
            where: {
              hubId: channelInHub.hubId,
              referenceDocId: originalMsg.id,
            },
            take: limit,
          })
          : [];
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
        content:
          'Messages to purge not found; messages sent over 24 hours ago have been automatically removed.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ fetchReply: true });

    const startTime = performance.now();
    const allNetworks = await connectedList.findMany({
      where: { hubId: channelInHub.hubId, connected: true },
    });

    const promiseResults = allNetworks.map(async (network) => {
      try {
        // TODO: Fine a better way to do this
        // because we are doing this in all the shards, which is double the work
        const evalRes = await interaction.client.cluster.broadcastEval(
          async (client, ctx) => {
            const channel = await client.channels.fetch(ctx.channelId);

            if (channel?.type === 0 || channel?.isThread()) {
              const messageIds = ctx.messagesInDb.flatMap((dbMsg) =>
                dbMsg.channelAndMessageIds
                  .filter(({ channelId }) => channelId === channel.id)
                  .map(({ messageId }) => messageId),
              );

              if (messageIds.length < 1) return [];

              await channel.bulkDelete(messageIds);
              return messageIds;
            }
          },
          { context: { channelId: network.channelId, messagesInDb } },
        );

        return interaction.client.resolveEval(evalRes) || [];
      }
      catch (e) {
        Logger.error(e);
        captureException(e);
      }

      return [];
    });

    const results = await Promise.all(promiseResults);
    const deletedMessages = results.reduce((acc, cur) => acc + cur.length, 0);
    const failedMessages = results.reduce((acc, cur) => (acc + cur.length > 0 ? 0 : 1), 0);

    const resultEmbed = new EmbedBuilder()
      .setDescription(
        stripIndents`
        ### ${emojis.delete} Purge Results

        Finished purging from **${allNetworks.length}** networks in \`${msToReadable(
  performance.now() - startTime,
)}\`.
      `,
      )
      .addFields([
        { name: 'Total Purged', value: `\`\`\`js\n${deletedMessages}\`\`\``, inline: true },
        { name: 'Errored Purges', value: `\`\`\`js\n${failedMessages}\`\`\``, inline: true },
        { name: 'Purge Limit', value: `\`\`\`js\n${limit || 'None'}\`\`\``, inline: true },
      ])
      .setFooter({
        text: `Purged By: ${interaction.user.username}`,
        iconURL: interaction.user.avatarURL() || undefined,
      })
      .setTimestamp()
      .setColor('Red');

    await interaction.followUp({ embeds: [resultEmbed] }).catch(captureException);

    const succeededMessages = results?.filter((i) => i.length > 0).flat();
    await messageData
      .deleteMany({
        where: { channelAndMessageIds: { some: { messageId: { in: succeededMessages } } } },
      })
      .catch(captureException);
  }
}
