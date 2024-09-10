import type { originalMessages, broadcastedMessages, userData } from '@prisma/client';
import type {
  User,
  Message,
  HexColorString,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
} from 'discord.js';

export interface ReferredMsgData {
  dbReferrence: (originalMessages & { broadcastMsgs: broadcastedMessages[] }) | null;
  referredAuthor: User | null;
  dbReferredAuthor: userData | null;
  referredMessage?: Message;
}

export interface BroadcastOpts {
  referredMsgData: ReferredMsgData;
  embedColor?: HexColorString;
  attachmentURL?: string | null;
}

export type CompactFormatOpts = {
  servername: string;
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

export type EmbedFormatOpts = {
  embeds: { normal: EmbedBuilder; censored: EmbedBuilder };
  jumpButton?: ActionRowBuilder<ButtonBuilder>[];
};
