import { Connection } from '@prisma/client';
import { WebhookMessageCreateOptions, EmbedBuilder, Message } from 'discord.js';
import { DefaultFormaterOpts, MessageFormatterStrategy } from '../MessageFormattingService.js';
import { censor } from '#main/utils/ProfanityUtils.js';
import Constants from '#main/utils/Constants.js';


export class CompactMessageFormatter implements MessageFormatterStrategy {
  format(
    message: Message<true>,
    connection: Connection,
    opts: DefaultFormaterOpts,
  ): WebhookMessageCreateOptions {
    const contents = {
      normal: message.content,
      referred: opts.referredContent,
      censored: opts.censoredContent,
    };

    const { referredAuthor } = opts.referredMsgData;

    // check if the person being replied to explicitly allowed mentionOnReply setting for themself
    const replyContent = this.getReplyContent(contents.referred, connection.profFilter);

    // discord displays either an embed or an attachment url in a compact message (embeds take priority, so image will not display)
    // which is why if there is an image, we don't send the reply embed. Reply button remains though
    const replyEmbed =
      replyContent && !opts.attachmentURL
        ? [
          new EmbedBuilder()
            .setDescription(replyContent)
            .setAuthor({
              name: referredAuthor?.username.slice(0, 30) ?? 'Unknown User',
              iconURL: referredAuthor?.displayAvatarURL(),
            })
            .setColor(Constants.Colors.invisible),
        ]
        : undefined;

    const { author, servername, jumpButton } = opts;

    // compact mode doesn't need new attachment url for tenor and direct image links
    // we can just slap them right in the content without any problems
    // [] has an empty char in between its not magic kthxbye
    const attachmentURL = message.attachments.size > 0 ? `\n[⁥](${opts.attachmentURL})` : '';
    const messageContent = `${connection.profFilter ? contents.censored : contents.normal} ${attachmentURL}`;

    return {
      username: `@${author.username} • ${servername}`,
      avatarURL: author.avatarURL,
      embeds: replyEmbed,
      components: jumpButton,
      content: messageContent,
      threadId: connection.parentId ? connection.channelId : undefined,
      allowedMentions: { parse: [] },
    };
  }

  private getReplyContent(content: string | undefined, profFilter: boolean) {
    if (!content) return null;
    return profFilter ? censor(content) : content;
  }
}
