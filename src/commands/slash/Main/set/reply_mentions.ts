import type { ChatInputCommandInteraction } from 'discord.js';
import SetCommand from './index.js';

export default class ReplyMention extends SetCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const { userManager } = interaction.client;
    const dbUser = await userManager.getUser(interaction.user.id);

    const mentionOnReply = interaction.options.getBoolean('enable', true);
    if (!dbUser) {
      await userManager.createUser({
        id: interaction.user.id,
        username: interaction.user.username,
        mentionOnReply,
      });
    }
    else {
      await userManager.updateUser(interaction.user.id, { mentionOnReply });
    }

    await this.replyEmbed(
      interaction,
      `${this.getEmoji('tick')} You will ${mentionOnReply ? 'now' : '**no longer**'} get pinged when someone replies to your messages.`,
      { flags: ['Ephemeral'] },
    );
  }
}
