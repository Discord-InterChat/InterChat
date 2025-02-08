/*
 * Copyright (C) 2025 InterChat
 *
 * InterChat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * InterChat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with InterChat.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { Message } from 'discord.js';
import { showRulesScreening } from '#src/interactions/RulesScreening.js';
import { HubService } from '#src/services/HubService.js';
import { getConnectionHubId } from '#src/utils/ConnectedListUtils.js';
import { checkBlockedWords } from '#src/utils/network/blockwordsRunner.js';
import { runChecks } from '#src/utils/network/runChecks.js';
import { BroadcastService } from './BroadcastService.js';
import { fetchUserData } from '#src/utils/Utils.js';

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

    const userData = await fetchUserData(message.author.id);
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

    const { passed } = await checkBlockedWords(message, await hub.fetchAntiSwearRules());
    if (!passed) return;

    await this.broadcastService.broadcastMessage(
      message,
      hub,
      hubConnections,
      connection,
      attachmentURL,
    );

    await message.client.userLevels.handleMessage(message);
  }
}
