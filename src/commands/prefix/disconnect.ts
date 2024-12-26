import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { LobbyManager } from '#main/managers/LobbyManager.js';
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

  protected async run(message: Message<true>) {
    const lobbies = new LobbyManager(message.client);
    const alreadyConnected = await lobbies.getLobbyByChannelId(message.channelId);

    if (alreadyConnected) {
      await lobbies.removeServerFromLobby(alreadyConnected.id, message.guildId);
    }
    else {
      await lobbies.removeChannelFromPool(message.channelId);
      await message.reply(`${this.getEmoji('disconnect')} Not connected to any lobby. Removed from waiting pool if exists.`);
      return;
    }

    await message.reply(`${this.getEmoji('disconnect')} You have left the lobby.`);
  }
}
