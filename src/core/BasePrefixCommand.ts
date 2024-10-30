import { Message, PermissionsBitField } from 'discord.js';

export interface CommandData {
  name: string;
  description: string;
  category: 'Moderation' | 'Network'; // add more categories as needed
  usage: string;
  examples: string[];
  aliases: string[];
  dbPermission?: boolean;
  cooldown?: number;
  ownerOnly?: boolean;
  requiredBotPermissions?: PermissionsBitField[];
  requiredUserPermissions?: PermissionsBitField[];
}

export default abstract class BasePrefixCommand {
  public abstract readonly data: CommandData;
  public abstract execute(message: Message, args: string[]): Promise<void>;
}
