import type {
  BroadcastOpts,
  CompactFormatOpts,
  EmbedFormatOpts,
} from '#main/utils/network/Types.d.ts';
import Constants from '#main/config/Constants.js';
import { censor } from '#main/utils/ProfanityUtils.js';
import type { connectedList, hubs, userData } from '@prisma/client';
import { EmbedBuilder, userMention, type WebhookMessageCreateOptions } from 'discord.js';

export const getEmbedMessageFormat = (
  connection: connectedList,
  hub: hubs,
  { embeds, jumpButton }: EmbedFormatOpts,
): WebhookMessageCreateOptions => ({
  components: jumpButton,
  embeds: [connection.profFilter ? embeds.censored : embeds.normal],
  username: `${hub.name}`,
  avatarURL: hub.iconUrl,
  threadId: connection.parentId ? connection.channelId : undefined,
  allowedMentions: { parse: [] },
});

const getReplyContent = (content: string | undefined, profFilter: boolean) => {
  if (!content) return null;
  return profFilter ? censor(content) : content;
};

export const getReplyMention = (dbReferredAuthor: userData | null) => {
  if (!dbReferredAuthor?.mentionOnReply) return null;
  return userMention(dbReferredAuthor.id);
};

export const getCompactMessageFormat = (
  connection: connectedList,
  opts: BroadcastOpts,
  { author, contents, servername, jumpButton, totalAttachments }: CompactFormatOpts,
): WebhookMessageCreateOptions => {
  const { referredAuthor } = opts.referredMsgData;

  // check if the person being replied to explicitly allowed mentionOnReply setting for themself
  const replyContent = getReplyContent(contents.referred, connection.profFilter);

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

  // compact mode doesn't need new attachment url for tenor and direct image links
  // we can just slap them right in the content without any problems
  const attachmentURL = totalAttachments > 0 ? `\n[.](${opts.attachmentURL})` : '';
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
};
