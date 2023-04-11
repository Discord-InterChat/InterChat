import discord from 'discord.js';
import EmojiIDs from '../../Utils/JSON/emoji.json';
import { Prisma } from '@prisma/client';

type InterchatCommand = {
  developer?: boolean,
  staff?: boolean,
  description?: string | undefined
  directory: string,
  data: discord.SlashCommandBuilder | discord.ContextMenuCommandBuilder,
  execute: (interaction: discord.ChatInputCommandInteraction | discord.MessageContextMenuCommandInteraction) => unknown
  autocomplete?: (interaction: discord.AutocompleteInteraction) => unknown
}

declare module 'discord.js' {
  export interface Client {
    commands: discord.Collection<string, InterchatCommand>;
    description: string;
    version: string;
    emotes: typeof EmojiIDs;
    /* A generated invite link for the bot */
    invite: string;
    sendInNetwork(
      message: string | MessageCreateOptions,
      hub: Prisma.hubsWhereUniqueInput,
    ): Promise<void>;
  }
}
