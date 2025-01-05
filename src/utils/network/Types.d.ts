import type { UserData } from '@prisma/client';
import type { Collection, HexColorString, Message, User } from 'discord.js';
import type { Broadcast, OriginalMessage } from '#main/utils/network/messageUtils.js';

export interface ReferredMsgData {
  dbReferrence: (OriginalMessage & { broadcastMsgs: Collection<string, Broadcast> }) | null;
  referredAuthor: User | null;
  dbReferredAuthor: UserData | null;
  referredMessage?: Message;
}

export interface BroadcastOpts {
  referredMsgData: ReferredMsgData;
  embedColor?: HexColorString;
  attachmentURL?: string | null;
}
