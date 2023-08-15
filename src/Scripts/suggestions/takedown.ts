import { ChatInputCommandInteraction, EmbedBuilder, ForumChannel } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';

export default {
  execute: async (interaction: ChatInputCommandInteraction) => {
    const keep = interaction.options.getBoolean('keepmessage');
    const postId = interaction.options.getString('postid');
    const suggestionChannel = await interaction.client.channels.fetch(constants.channel.suggestions) as ForumChannel | null;

    let suggestionPost;
    let suggestionMessage;

    try {
      suggestionPost = await suggestionChannel?.threads.fetch(String(postId));
    }
    catch {
      return interaction.reply('Unable to locate the forum post.');
    }

    try {
      suggestionMessage = await suggestionPost?.fetchStarterMessage();
    }
    catch {
      return interaction.reply('Unable to locate the posted message.');
    }

    if (suggestionMessage?.author.id != interaction.client.user?.id) {
      await interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');
      return;
    }

    if (keep) {
      suggestionMessage?.edit({
        embeds: [
          new EmbedBuilder()
            .setDescription('*This suggestion was taken down.*')
            .setColor(colors('invisible')),
        ],
      });
    }
    else {
      suggestionPost?.setLocked(true);
      try {
        await suggestionMessage?.delete();
      }
      catch {
        interaction.channel?.send('Unable to delete message!');
      }
    }

    await interaction.reply('🗑️ Suggestion discarded.');
    suggestionPost?.setArchived(true, `Suggestion taken down by ${interaction.user.username}`);
  },
};
