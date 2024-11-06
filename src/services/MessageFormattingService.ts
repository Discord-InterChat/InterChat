import { BroadcastOpts, ReferredMsgData } from '#main/utils/network/Types.js';
import { connectedList, Hub } from '@prisma/client';
import { ActionRowBuilder, ButtonBuilder, Message, userMention, WebhookMessageCreateOptions } from 'discord.js';
import { CompactMessageFormatter } from './formatters/CompactMsgFormatter.js';
import { EmbedMessageFormatter } from './formatters/EmbedMsgFormatter.js';

export interface MessageFormatterStrategy {
  format(
    message: Message<true>,
    connection: connectedList,
    opts: DefaultFormaterOpts
  ): WebhookMessageCreateOptions;
}

export type DefaultFormaterOpts = BroadcastOpts & {
  username: string;
  censoredContent: string;
  referredContent: string | undefined;
  servername: string;
  author: {
    username: string;
    avatarURL: string;
  };
  hub: Hub;
  jumpButton?: ActionRowBuilder<ButtonBuilder>[];
};

export default class MessageFormattingService {
  private readonly strategy: MessageFormatterStrategy;
  private readonly connection: connectedList;

  constructor(connection: connectedList) {
    this.strategy = connection.compact
      ? new CompactMessageFormatter()
      : new EmbedMessageFormatter();
    this.connection = connection;
  }

  format(
    message: Message<true>,
    opts: DefaultFormaterOpts,
  ): WebhookMessageCreateOptions {
    const formatted = this.strategy.format(message, this.connection, opts);
    return this.addReplyMention(formatted, this.connection, opts.referredMsgData);
  }
  private addReplyMention(
    messageFormat: WebhookMessageCreateOptions,
    connection: connectedList,
    referredMsgData?: ReferredMsgData,
  ): WebhookMessageCreateOptions {
    if (referredMsgData && connection.serverId === referredMsgData.dbReferrence?.guildId) {
      const { dbReferredAuthor, dbReferrence } = referredMsgData;
      const replyMention = dbReferredAuthor?.mentionOnReply ? userMention(dbReferredAuthor.id) : '';

      messageFormat.content = `${replyMention} ${messageFormat.content ?? ''}`;
      messageFormat.allowedMentions = {
        ...messageFormat.allowedMentions,
        users: [...(messageFormat.allowedMentions?.users ?? []), dbReferrence.authorId],
      };
    }

    return messageFormat;
  }
}
