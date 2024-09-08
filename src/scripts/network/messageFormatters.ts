import Constants from '#main/utils/Constants.js';
import { censor } from '#main/utils/Profanity.js';
import type { broadcastedMessages, connectedList, hubs, originalMessages } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  type HexColorString,
  type Message,
  type User,
  type WebhookMessageCreateOptions,
} from 'discord.js';

export interface BroadcastOpts {
  embedColor?: HexColorString | null;
  attachmentURL?: string | null;
  referredMessage: Message | null;
  dbReferrence: (originalMessages & { broadcastMsgs: broadcastedMessages[] }) | null;
  referredAuthor: User | null;
}

type CompactFormatOpts = {
  servername: string;
  referredAuthorName: string;
  totalAttachments: number;
  author: {
    username: string;
    avatarURL: string;
  };
  contents: {
    normal: string;
    censored: string;
    referred: string | undefined;
  };
  jumpButton?: ActionRowBuilder<ButtonBuilder>[];
};

type EmbedFormatOpts = {
  embeds: { normal: EmbedBuilder; censored: EmbedBuilder };
  jumpButton?: ActionRowBuilder<ButtonBuilder>[];
};

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

export const getCompactMessageFormat = (
  connection: connectedList,
  opts: BroadcastOpts,
  {
    author,
    contents,
    servername,
    jumpButton,
    totalAttachments,
    referredAuthorName,
  }: CompactFormatOpts,
): WebhookMessageCreateOptions => {
  const replyContent =
    connection.profFilter && contents.referred ? censor(contents.referred) : contents.referred;
  let replyEmbed;

  // discord displays either an embed or an attachment url in a compact message (embeds take priority, so image will not display)
  // which is why if there is an image, we don't send the reply embed. Reply button remains though
  if (replyContent && !opts.attachmentURL) {
    replyEmbed = [
      new EmbedBuilder()
        .setDescription(replyContent)
        .setAuthor({
          name: referredAuthorName,
          iconURL: opts.referredAuthor?.displayAvatarURL(),
        })
        .setColor(Constants.Colors.invisible),
    ];
  }

  // compact mode doesn't need new attachment url for tenor and direct image links
  // we can just slap them right in the content without any problems
  const attachmentUrl = totalAttachments > 0 ? `\n[.](${opts.attachmentURL})` : '';

  return {
    username: `@${author.username} • ${servername}`,
    avatarURL: author.avatarURL,
    embeds: replyEmbed,
    components: jumpButton,
    content: `${connection.profFilter ? contents.censored : contents.normal} ${attachmentUrl}`,
    threadId: connection.parentId ? connection.channelId : undefined,
    allowedMentions: { parse: [] },
  };
};
