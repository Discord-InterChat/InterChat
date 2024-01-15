import { EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import { paginate } from '../../../utils/Pagination.js';
import { stripIndents } from 'common-tags';
import { LINKS, colors, emojis } from '../../../utils/Constants.js';

export default class Help extends BaseCommand {
  readonly data = {
    name: 'help',
    description: 'Shows the help menu for InterChat.',
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const baseEmbed = new EmbedBuilder()
      .setColor(colors.invisible)
      .setThumbnail(interaction.client.user.displayAvatarURL());

    const page1 = EmbedBuilder.from(baseEmbed)
      .setTitle('Welcome to InterChat!')
      .setDescription(
        stripIndents`
        With InterChat you can chat with friends from different servers in real-time, easy to setup setup—just invite InterChat, create a special chat space or join one, and start talking! With InterChat you can chat with people from other servers, boosting your server's activity and making it more fun for everyone.

        This simple guide will show you how to set up InterChat and start enjoying the benefits of cross-server communication.
    `,
      );
    const page2 = EmbedBuilder.from(baseEmbed)
      .setTitle('Quick Setup')
      .setThumbnail('https://i.imgur.com/0GPapkN.png')
      .addFields(
        {
          name: 'Step 1: Browse Hubs',
          value:
            'Type </hub browse:1107639810014847049> to discover existing public InterChat communities. Find topics that interest you!',
          inline: true,
        },
        {
          name: 'Step 2: Join a Hub',
          value:
            'Once you find a hub you like, simply type </hub join:1107639810014847049>. To avoid clutter, keep a separate channel for InterChat messages. You\'ll be connected to the hub instantly.',
          inline: true,
        },
        {
          name: 'Step 3: All set!',
          value:
            'To chat with people from other servers, simply type in the channel you just used to join the hub. You\'ll be able to see messages from other servers and send your own.',
          inline: true,
        },
        {
          // empty field to make the embed look better
          name: '\u200b',
          value:
            'It\'s as simple as that! You\'re now ready to start chatting with people from other servers. 🎉',
        },
      );

    const page3 = EmbedBuilder.from(baseEmbed)
      .setTitle('Useful Commands')
      .setThumbnail('https://i.imgur.com/MrhM6yN.png').setDescription(stripIndents`
      Here are some essential commands to help you get started:

      - </hub join:1107639810014847049>・Join a public or private hub using its name or invite.
      - </hub browse:1107639810014847049>・Find public hubs and join them.
      - </hub create:1107639810014847049>・Make your own hub and invite others to join.
      - </hub manage:1107639810014847049>・Customize and manage your hubs.
      - </connection:1170719616872501300>・Manage your connections. You can choose an embed color, customize hub icons, switch to a compact mode and more.

      ${emojis.info} You can view other commands aside from these by typing  /.
    `);

    const page4 = EmbedBuilder.from(baseEmbed).setTitle('Final Notes').setDescription(stripIndents`
    You\'re all set! You can now chat with people from other servers in real-time. For more detailed information and advanced features, refer to the official  [InterChat online guide](${LINKS.DOCS}). Have fun! 🎉
    
    For any questions, suggestions or feedback, join the [support server](https://discord.gg/2YkZAP2) or [vote for InterChat](https://top.gg/bot/769921109209907241/vote).
    `);

    paginate(interaction, [page1, page2, page3, page4]);
  }
}
