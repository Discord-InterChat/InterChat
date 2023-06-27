import discord from 'discord.js';
import EmojiIDs from '../src/Utils/JSON/emoji.json';
import { Prisma } from '@prisma/client';

type InterchatCommand = {
  developer?: boolean,
  staff?: boolean,
  /* Cooldown in milliseconds  */
  cooldown?: number,
  description?: string | undefined
  directory: string,
  data: discord.SlashCommandBuilder | discord.ContextMenuCommandBuilder,
  execute: (interaction: discord.ChatInputCommandInteraction | discord.ContextMenuCommandInteraction) => unknown
  autocomplete?: (interaction: discord.AutocompleteInteraction) => unknown
}

declare module 'discord.js' {
  export interface Client {
    commands: discord.Collection<string, InterchatCommand>;
    description: string;
    version: string;
    emotes: typeof EmojiIDs;
    commandCooldowns: discord.Collection<`${string}-${discord.Snowflake}`, number>;
    /* A generated invite link for the bot */
    invite: string;
    sendInNetwork(
      message: string | MessageCreateOptions,
      hub: Prisma.hubsWhereUniqueInput,
    ): Promise<void>;
  }
}