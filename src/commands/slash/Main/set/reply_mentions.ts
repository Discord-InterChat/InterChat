import type { ChatInputCommandInteraction } from 'discord.js';
import SetCommand from './index.js';
import UserDbService from '#main/services/UserDbService.js';

export default class ReplyMention extends SetCommand {
  async execute(interaction: ChatInputCommandInteraction) {

    const userService = new UserDbService();
    const dbUser = await userService.getUser(interaction.user.id);

    const mentionOnReply = interaction.options.getBoolean('enable', true);
    if (!dbUser) {
      await userService.createUser({
        id: interaction.user.id,
        username: interaction.user.username,
        mentionOnReply,
      });
    }
    else {
      await userService.updateUser(interaction.user.id, { mentionOnReply });
    }

    await this.replyEmbed(
      interaction,
      `${this.getEmoji('tick')} You will ${mentionOnReply ? 'now' : '**no longer**'} get pinged when someone replies to your messages.`,
      { flags: ['Ephemeral'] },
    );
  }
}
