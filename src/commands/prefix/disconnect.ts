import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { LobbyManager } from '#main/managers/LobbyManager.js';
import { emojis } from '#main/utils/Constants.js';
import { Message, PermissionsBitField } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'disconnect',
    description: 'Disconnect from current lobby',
    category: 'Moderation',
    usage: 'disconnect',
    examples: ['leavelobby', 'll', 'disconnect', 'dc', 'hangup'],
    aliases: ['hangup', 'dc', 'disconn', 'leave'],
    requiredBotPermissions: new PermissionsBitField(['SendMessages', 'EmbedLinks', 'ReadMessageHistory']),
    dbPermission: false,
    requiredArgs: 0,
  };

  private readonly lobbyManager = new LobbyManager();

  protected async run(message: Message<true>) {
    const alreadyConnected = await this.lobbyManager.getLobbyByChannelId(message.channelId);

    if (alreadyConnected) {
      await this.lobbyManager.removeServerFromLobby(alreadyConnected.id, message.guildId);
    }
    else {
      await this.lobbyManager.removeFromWaitingPool(message.guildId);
      await message.reply(`${emojis.disconnect} Not connected to any lobby. Removed from waiting pool if exists.`);
      return;
    }

    await message.reply(`${emojis.disconnect} You have left the lobby.`);
  }
}
