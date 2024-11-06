import { connectedList } from '@prisma/client';
import { Message, WebhookMessageCreateOptions } from 'discord.js';
import { DefaultFormaterOpts, MessageFormatterStrategy } from '../MessageFormattingService.js';
import { buildNetworkEmbed } from '#main/utils/network/helpers.js';

export class EmbedMessageFormatter implements MessageFormatterStrategy {
  format(
    message: Message<true>,
    connection: connectedList,
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
