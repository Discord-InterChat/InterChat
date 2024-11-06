import { Message } from 'discord.js';
import type { ChatGroup } from '#types/ChatTypes.d.ts';
import type { ConnectionData } from '#types/ConnectionTypes.d.ts';
import { BroadcastService } from './BroadcastService.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { checkBlockedWords } from '#main/utils/network/blockwordsRunner.js';
import { runChecks } from '#main/utils/network/runChecks.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';

export class MessageProcessor {
  private readonly broadcastService: BroadcastService;

  constructor() {
    this.broadcastService = new BroadcastService();
  }

  async processGroupMessage(message: Message, group: ChatGroup) {
    await this.updateGroupActivity(message, group);

    for (const server of group.connections) {
      if (server.channelId === message.channelId) continue;

      const channel = await message.client.channels.fetch(server.channelId);
      if (channel?.isSendable()) {
        await channel.send(`**${message.author.username}**: ${message.content}`);
      }
    }
  }

  async processHubMessage(message: Message<true>, connectionData: ConnectionData) {
    const { connection, hub, hubConnections } = connectionData;
    const { userManager } = message.client;

    const userData = await userManager.getUser(message.author.id);
    if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

    const settings = new HubSettingsManager(hub.id, hub.settings);
    const attachmentURL = await this.broadcastService.resolveAttachmentURL(message);

    if (
      !(await runChecks(message, hub, {
        userData,
        settings,
        attachmentURL,
        totalHubConnections: hubConnections.length,
      }))
    ) {
      return;
    }

    message.channel.sendTyping().catch(() => null);

    const { passed } = await checkBlockedWords(message, hub.msgBlockList);
    if (!passed) return;

    await this.broadcastService.broadcastMessage(
      message,
      hub,
      hubConnections,
      settings,
      connection,
    );
  }

  private async updateGroupActivity(message: Message, group: ChatGroup) {
    const { chatService } = message.client;
    await chatService.updateActivity(group.id, message.channelId);
  }
}
