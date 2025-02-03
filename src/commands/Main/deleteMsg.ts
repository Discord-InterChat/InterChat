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

import BaseCommand from '#src/core/BaseCommand.js';
import type HubManager from '#src/managers/HubManager.js';
import { HubService } from '#src/services/HubService.js';
import {
  type OriginalMessage,
  findOriginalMessage,
  getBroadcasts,
  getOriginalMessage,
} from '#src/utils/network/messageUtils.js';

import type Context from '#src/core/CommandContext/Context.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import { t } from '#utils/Locale.js';
import { logMsgDelete } from '#utils/hub/logger/ModLogs.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import {
  deleteMessageFromHub,
  isDeleteInProgress,
} from '#utils/moderation/deleteMessage.js';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from 'discord.js';

export default class DeleteMessage extends BaseCommand {
  readonly cooldown = 10_000;

  constructor() {
    super({
      name: 'deletemsg',
      description: 'Delete a message you sent using interchat.',
      types: {
        prefix: true,
        slash: true,
        contextMenu: {
          name: 'Delete Message',
          type: ApplicationCommandType.Message,
        },
      },
      contexts: { guildOnly: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'message',
          description: 'The message to delete',
          required: true,
        },
      ],
    });
  }

  async execute(ctx: Context): Promise<void> {
    if (!ctx.inGuild()) return;

    await ctx.deferReply({ flags: ['Ephemeral'] });

    const targetId = ctx.getTargetMessageId('message');
    const originalMsg = targetId
      ? await this.getOriginalMessage(targetId)
      : null;
    const hub = await this.fetchHub(originalMsg?.hubId);

    const validation = await this.validateMessage(ctx, originalMsg, hub);
    if (!validation || !originalMsg) return;

    await this.processMessageDeletion(ctx, originalMsg, validation.hub);
  }

  private async getOriginalMessage(messageId: string) {
    const originalMsg =
			(await getOriginalMessage(messageId)) ??
			(await findOriginalMessage(messageId));
    return originalMsg;
  }

  private async processMessageDeletion(
    ctx: Context,
    originalMsg: OriginalMessage,
    hub: HubManager,
  ): Promise<void> {
    const locale = await fetchUserLocale(ctx.user.id);

    await ctx.editReply(
      `${ctx.getEmoji('tick_icon')} Your request has been queued. Messages will be deleted shortly...`,
    );

    const broadcasts = Object.values(
      await getBroadcasts(originalMsg.messageId, originalMsg.hubId),
    );
    const { deletedCount } = await deleteMessageFromHub(
      hub.id,
      originalMsg.messageId,
      broadcasts,
    );

    await ctx
      .editReply(
        t('network.deleteSuccess', locale, {
          emoji: ctx.getEmoji('tick_icon'),
          user: `<@${originalMsg.authorId}>`,
          deleted: `${deletedCount}`,
          total: `${broadcasts.length}`,
        }),
      )
      .catch(() => null);

    await this.logDeletion(ctx, hub, originalMsg);
  }

  private async fetchHub(hubId?: string): Promise<HubManager | null> {
    if (!hubId) return null;
    return await new HubService().fetchHub(hubId);
  }

  private async validateMessage(
    ctx: Context,
    originalMsg: OriginalMessage | null,
    hub: HubManager | null,
  ) {
    const locale = await fetchUserLocale(ctx.user.id);

    if (!originalMsg || !hub) {
      await ctx.editReply(
        t('errors.unknownNetworkMessage', locale, {
          emoji: ctx.getEmoji('x_icon'),
        }),
      );
      return false;
    }

    if (await isDeleteInProgress(originalMsg.messageId)) {
      await ctx.replyEmbed(
        `${ctx.getEmoji('neutral')} This message is already deleted or is being deleted by another moderator.`,
        { flags: ['Ephemeral'], edit: true },
      );
      return false;
    }

    if (
      ctx.user.id !== originalMsg.authorId &&
			!(await isStaffOrHubMod(ctx.user.id, hub))
    ) {
      await ctx.editReply(
        t('errors.notMessageAuthor', locale, {
          emoji: ctx.getEmoji('x_icon'),
        }),
      );
      return false;
    }

    return { hub };
  }

  private async logDeletion(
    ctx: Context,
    hub: HubManager,
    originalMsg: OriginalMessage,
  ): Promise<void> {
    if (!(await isStaffOrHubMod(ctx.user.id, hub))) return;

    await logMsgDelete(ctx.client, originalMsg, await hub.fetchLogConfig(), {
      hubName: hub.data.name,
      modName: ctx.user.username,
    });
  }
}
