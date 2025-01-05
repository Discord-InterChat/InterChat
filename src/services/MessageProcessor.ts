import type { Message } from 'discord.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import { HubService } from '#main/services/HubService.js';
import { getConnectionHubId } from '#main/utils/ConnectedListUtils.js';
import { checkBlockedWords } from '#main/utils/network/blockwordsRunner.js';
import { runChecks } from '#main/utils/network/runChecks.js';
import { BroadcastService } from './BroadcastService.js';

export class MessageProcessor {
  private readonly broadcastService: BroadcastService;
  private readonly hubService = new HubService();

  constructor() {
    this.broadcastService = new BroadcastService();
  }

  async processHubMessage(message: Message<true>) {
    const connectionHubId = await getConnectionHubId(message.channelId);
    if (!connectionHubId) return null;

    const hub = await this.hubService.fetchHub(connectionHubId);
    if (!hub) return null;

    const allConnections = await hub.connections.fetch();
    const hubConnections = allConnections.filter(
      (c) => c.data.connected && c.data.channelId !== message.channelId,
    );
    const connection = allConnections.find((c) => c.data.channelId === message.channelId);
    if (!connection?.data.connected) return null;

    const { userManager } = message.client;
    const userData = await userManager.getUser(message.author.id);
    if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

    const attachmentURL = await this.broadcastService.resolveAttachmentURL(message);

    if (
      !(await runChecks(message, hub, {
        userData,
        settings: hub.settings,
        attachmentURL,
        totalHubConnections: allConnections.length,
      }))
    ) {
      return;
    }

    message.channel.sendTyping().catch(() => null);

    const { passed } = await checkBlockedWords(message, await hub.fetchBlockWords());
    if (!passed) return;

    await this.broadcastService.broadcastMessage(message, hub, hubConnections, connection);
  }
}
