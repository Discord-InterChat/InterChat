import { ChatInputCommandInteraction, EmbedBuilder, ForumChannel } from 'discord.js';
import { constants } from '../../Utils/utils';

type suggestionStatus ='✅ Approved' | '🧑‍💻 Pending' | '✅ Implemented' | '❌ Rejected' | '🚫 Closed';

export default {
  execute: async (interaction: ChatInputCommandInteraction) => {
    const postId = interaction.options.getString('postid');
    const status = interaction.options.getString('status') as suggestionStatus | null;
    const reason = interaction.options.getString('reason');
    const suggestionChannel = await interaction.client.channels.fetch(constants.channel.suggestions) as ForumChannel | null;
    const suggestionPost = await suggestionChannel?.threads?.fetch(String(postId)).catch(() => { interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');});
    const suggestionMessage = await suggestionPost?.fetchStarterMessage();

    if (!suggestionMessage
			|| suggestionMessage.embeds.length < 1
			|| suggestionMessage.author.id != interaction.client.user?.id
			|| suggestionMessage.embeds[0].description?.includes('taken down')
    ) {
      await interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');
      return;
    }
    const suggestionEmbed = new EmbedBuilder(suggestionMessage?.embeds[0].toJSON());
    suggestionEmbed.setFields({ name: 'Status', value: String(status) });

    if (reason) suggestionEmbed.addFields({ name: 'Message From Staff/Developers', value: String(reason) });

    await suggestionMessage?.edit({ embeds: [suggestionEmbed] });

    if (status === '🚫 Closed' || status === '❌ Rejected') suggestionPost?.setArchived(true, `Closed by ${interaction.user.username}`);

    interaction.reply({ content: 'Updated suggestion!', ephemeral: true }).catch();

  },
};