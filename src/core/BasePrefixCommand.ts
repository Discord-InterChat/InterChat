import { emojis } from '#utils/Constants.js';
import Logger from '#main/utils/Logger.js';
import { isDev } from '#main/utils/Utils.js';
import { Message, PermissionsBitField } from 'discord.js';

export interface CommandData {
  name: string;
  description: string;
  category: 'Moderation' | 'Network' | 'Utility'; // add more categories as needed
  usage: string;
  examples: string[];
  aliases: string[];
  dbPermission?: boolean;
  requiredArgs: number;
  cooldown?: number;
  ownerOnly?: boolean;
  requiredBotPermissions?: PermissionsBitField;
  requiredUserPermissions?: PermissionsBitField;
}

export default abstract class BasePrefixCommand {
  public abstract readonly data: CommandData;
  protected abstract run(message: Message, args: string[]): Promise<void>;
  public async execute(message: Message, args: string[]): Promise<void> {
    try {
      // Check if command is owner-only
      if (this.data.ownerOnly && !isDev(message.author.id)) {
        await message.reply(`${emojis.botdev} This command can only be used by the bot owner.`);
        return;
      }

      // Check user permissions
      const { requiredBotPermissions, requiredUserPermissions } = this.data;

      const missingPerms =
        requiredUserPermissions &&
        message.member?.permissions.missing(requiredUserPermissions, true);
      if (missingPerms?.length) {
        await message.reply(
          `${emojis.neutral} You're missing the following permissions: ${missingPerms.join(', ')}`,
        );
        return;
      }

      const botMissingPerms =
        requiredBotPermissions &&
        message.guild?.members.me?.permissions.missing(requiredBotPermissions, true);
      if (botMissingPerms?.length) {
        await message.reply(
          `${emojis.no} I'm missing the following permissions: ${botMissingPerms.join(', ')}`,
        );
        return;
      }

      if (this.data.dbPermission && !message.inGuild()) {
        await message.reply(`${emojis.no} This command can only be used in a server.`);
        return;
      }

      if (this.data.requiredArgs > args.length) {
        const prefix = 'c!';
        const examplesStr =
          this.data.examples.length > 0
            ? `\n**Examples**:\n${this.data.examples.map((e) => `${prefix}${e}`).join('\n')}`
            : '';

        await message.reply({
          content: `${emojis.neutral} One or more args missing.\n**Usage**: ${this.data.usage}${examplesStr}`,
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      // Run command
      await this.run(message, args);
    }
    catch (error) {
      Logger.error(error);
      await message.reply('There was an error executing this command!');
    }
  }
}
