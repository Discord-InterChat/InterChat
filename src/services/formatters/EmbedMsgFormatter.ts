import type { Connection } from '@prisma/client';
import type { Message, WebhookMessageCreateOptions } from 'discord.js';
import { buildNetworkEmbed } from '#src/utils/network/utils.js';
import type { DefaultFormaterOpts, MessageFormatterStrategy } from '../MessageFormattingService.js';

export class EmbedMessageFormatter implements MessageFormatterStrategy {
  format(
    message: Message<true>,
    connection: Connection,
    opts: DefaultFormaterOpts,
  ): WebhookMessageCreateOptions {
    const embeds = buildNetworkEmbed(message, opts.username, opts.censoredContent, {
      attachmentURL: opts.attachmentURL,
      referredContent: opts.referredContent,
      embedCol: opts.embedColor,
    });

    return {
      components: opts.jumpButton,
      embeds: [connection.profFilter ? embeds.censored : embeds.normal],
      username: `${opts.hub.name}`,
      avatarURL: opts.hub.iconUrl,
      threadId: connection.parentId ? connection.channelId : undefined,
      allowedMentions: { parse: [] },
    };
  }
}
