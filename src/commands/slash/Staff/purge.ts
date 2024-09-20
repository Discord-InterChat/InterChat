import {
  APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import db from '#main/utils/Db.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { stripIndents } from 'common-tags';
import { emojis } from '#main/config/Constants.js';
import {
  simpleEmbed,
  msToReadable,
  deleteMsgsFromDb,
  handleError,
  resolveEval,
} from '#main/utils/Utils.js';
import { broadcastedMessages } from '@prisma/client';

const limitOpt: APIApplicationCommandBasicOption = {
  type: ApplicationCommandOptionType.Integer,
  name: 'limit',
  description: 'Number of messages to delete. Max: 100',
  required: true,
  max_value: 100,
};

export default class Purge extends BaseCommand {
  readonly staffOnly = true;
  readonly cooldown = 60 * 1000;
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
          limitOpt,
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
          limitOpt,
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
          limitOpt,
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'any',
        description: 'Purge messages from the network. Staff-only',
        options: [limitOpt],
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

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const isOnCooldown = await this.checkOrSetCooldown(interaction);
    if (isOnCooldown) return;

    await interaction.deferReply({ fetchReply: true });

    const subcommand = interaction.options.getSubcommand();
    const limit = interaction.options.getInteger('limit') || 100;
    const channelInHub = await db.connectedList.findFirst({
      where: { channelId: interaction.channelId, connected: true },
    });

    const isMod = db.hubs.findFirst({
      where: {
        OR: [
          { moderators: { some: { userId: interaction.user.id } } },
          { ownerId: interaction.user.id },
        ],
      },
    });

    if (!isMod) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            `${emojis.no} You must be a moderator or owner of this hub to use this command.`,
          ),
        ],
      });
      return;
    }

    if (!channelInHub) {
      await interaction.editReply({
        content: 'This channel is not connected to a hub.',
      });
      return;
    }

    let messagesInDb: broadcastedMessages[] = [];

    switch (subcommand) {
      case 'server': {
        const serverId = interaction.options.getString('server', true);
        const serverRes = await db.originalMessages.findMany({
          where: { serverId, hubId: channelInHub.hubId },
          select: { broadcastMsgs: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        messagesInDb = serverRes.flatMap((i) => i.broadcastMsgs);
        break;
      }

      case 'user': {
        const authorId = interaction.options.getString('user', true);
        const userRes = await db.originalMessages.findMany({
          where: { authorId, hubId: channelInHub.hubId },
          select: { broadcastMsgs: true },
          orderBy: { messageId: 'desc' },
          take: limit,
        });

        messagesInDb = userRes.flatMap((i) => i.broadcastMsgs);
        break;
      }
      case 'after': {
        const messageId = interaction.options.getString('message', true);
        const fetchedMsg = await interaction.channel?.messages.fetch(messageId).catch(() => null);

        if (fetchedMsg) {
          const messagesRes = await db.originalMessages.findMany({
            where: { hubId: channelInHub.hubId, createdAt: { gte: fetchedMsg.createdAt } },
            take: limit,
            select: { broadcastMsgs: true },
          });

          messagesInDb = messagesRes.flatMap((m) => m.broadcastMsgs);
        }
        break;
      }
      case 'replies': {
        const messageReference = interaction.options.getString('replied-to', true);
        messagesInDb = (
          await db.originalMessages.findMany({
            where: { messageReference },
            include: { broadcastMsgs: true },
          })
        ).flatMap((i) => i.broadcastMsgs);

        break;
      }
      case 'any':
        messagesInDb = (
          await db.originalMessages.findMany({
            where: { hubId: channelInHub.hubId },
            orderBy: { messageId: 'desc' },
            include: { broadcastMsgs: true },
            take: limit,
          })
        ).flatMap((i) => i.broadcastMsgs);
        break;

      default:
        break;
    }

    if (!messagesInDb || messagesInDb.length < 1) {
      await interaction.editReply(
        'Messages to purge not found; messages sent over 24 hours ago have been automatically removed.',
      );
      return;
    }

    const startTime = performance.now();
    const allNetworks = await db.connectedList.findMany({
      where: { hubId: channelInHub.hubId, connected: true },
    });

    const promiseResults = allNetworks.map(async (network) => {
      try {
        // TODO: Find a better way to do this
        // because we are doing this in all the shards, which is double the work
        const evalRes = await interaction.client.cluster.broadcastEval(
          async (client, ctx) => {
            const channel = await client.channels.fetch(ctx.channelId);

            // using type as 0 because we cant access ChannelType enum inside eval
            if (channel?.type === 0 || channel?.isThread()) {
              const messageIds = ctx.messagesInDb
                .filter(({ channelId }) => channelId === channel.id)
                .map(({ messageId }) => messageId);

              if (messageIds.length < 1) return [];

              await channel.bulkDelete(messageIds);
              return messageIds;
            }
            return null;
          },
          { context: { channelId: network.channelId, messagesInDb } },
        );

        return resolveEval(evalRes) || [];
      }
      catch (e) {
        handleError(e);
      }

      return [];
    });

    const results = await Promise.all(promiseResults);
    const deletedMessages = results.reduce((acc, cur) => acc + cur.length, 0);
    const failedMessages = results.reduce((acc, cur) => (acc + cur.length > 0 ? 0 : 1), 0);
    const timeTaken = performance.now() - startTime;

    const resultEmbed = new EmbedBuilder()
      .setDescription(
        stripIndents`
        ### ${emojis.delete} Purge Results

        Finished purging from **${allNetworks.length}** networks in \`${msToReadable(timeTaken)}\`.
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

    await interaction.followUp({ embeds: [resultEmbed] });

    const succeededMessages = results?.filter((i) => i.length > 0).flat();
    await deleteMsgsFromDb(succeededMessages);
  }
}
