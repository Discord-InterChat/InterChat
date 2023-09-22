import { Client, OAuth2Scopes, PermissionFlagsBits } from 'discord.js';
import { topgg } from '../Utils/misc/utils';
import startTimers from '../Utils/misc/timers';
import logger from '../Utils/logger';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    logger.info(`Logged in as ${client.user?.username}! Cached ${client.guilds.cache.size} guilds.`);

    // Run misc tasks on startup
    const permissions = [
      PermissionFlagsBits.ManageWebhooks,
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ViewAuditLog,
    ];
    client.invite = client.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions });
    topgg.postStats({ serverCount: client.guilds.cache.size });
    startTimers(client);
  },
};
