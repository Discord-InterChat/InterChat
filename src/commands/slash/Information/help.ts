import { stripIndents } from 'common-tags';
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { URLs, colors, emojis } from '../../../utils/Constants.js';
import BaseCommand from '../../BaseCommand.js';
import { getCredits, setComponentExpiry } from '../../../utils/Utils.js';
import { CustomID } from '../../../structures/CustomID.js';
import { RegisterInteractionHandler } from '../../../decorators/Interaction.js';

export default class Help extends BaseCommand {
  readonly data = {
    name: 'help',
    description: 'Shows all commands (soon) and guides for InterChat.',
  };

  async execute(interaction: ChatInputCommandInteraction) {
    // TODO ${emojis.slashCommand}  [**All Commands**](https://discord-interchat.github.io/docs/category/commands)
    const embed = new EmbedBuilder()
      .setColor(colors.interchatBlue)
      .setThumbnail(interaction.client.user.avatarURL())
      .setDescription(
        stripIndents`
        ## InterChat Help
        InterChat is a powerful discord bot that enables effortless cross-server chatting! Get started by looking at the categories below.
        ### Categories:
        - 👥 [**InterChat Hubs**](https://discord-interchat.github.io/docs/hub/joining)
        - ⚙️ [**Setting up InterChat**](https://discord-interchat.github.io/docs/setup)
        - 💬 [**Messaging & Network**](https://discord-interchat.github.io/docs/messaging)
      `,
      )
      .setFooter({
        text: `Requested by @${interaction.user.username}`,
        iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
      });

    const selects = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder({
        customId: new CustomID('credits:guide', [interaction.user.id])
          .setIdentifier('credits', 'guide')
          .addArgs(interaction.user.id)
          .toString(),
        options: [
          {
            label: 'Hubs',
            value: 'hubs',
            emoji: '👥',
            description: 'How to join, leave, create, delete and use Hubs.',
          },
          {
            label: 'Network',
            value: 'network',
            emoji: '🌐',
            description: 'How the InterChat network (Inter-Server Chat) works.',
          },
          {
            label: 'Messaging',
            value: 'messaging',
            emoji: '💬',
            description: 'How to send, edit, delete and react to network messages!',
          },
          {
            label: 'The Team',
            value: 'credits',
            emoji: emojis.wand,
            description: 'Learn more about the team behind InterChat!',
          },
        ],
        placeholder: 'Select a Category...',
      }),
    );

    const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Invite')
        .setURL('https://discord.com/application-directory/769921109209907241'),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Guide')
        .setURL('https://discord-interchat.github.io/docs'),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Support')
        .setURL(URLs.SUPPORT_INVITE),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    await interaction.reply({
      embeds: [embed],
      components: [selects, linkButtons],
    });

    // Disable the components after 10 minutes
    setComponentExpiry(
      interaction.client.getScheduler(),
      await interaction.fetchReply(),
      60 * 15000,
    );
  }

  @RegisterInteractionHandler('credits')
  async handleComponents(interaction: StringSelectMenuInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    if (interaction.user.id !== customId.args[0]) {
      await interaction.reply({
        content: 'This button is not for you.',
        ephemeral: true,
      });
    }

    const templateEmbed = new EmbedBuilder()
      .setColor(colors.interchatBlue)
      .setThumbnail(interaction.client.user.avatarURL())
      .setFooter({
        text: `Requested by @${interaction.user.username}`,
        iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
      });

    switch (interaction.values[0]) {
      case 'hubs': {
        const hubsEmbed = EmbedBuilder.from(templateEmbed).setDescription(stripIndents`
          ## InterChat Hubs
          Think of hubs as your personal chat spaces, both creatable and joinable. They're like an exclusive room, where other servers can join to engage and chat together.

          ### Hub Guides
          - ${emojis.join} [**Join a Hub**](https://discord-interchat.github.io/docs/hub/joining) 
          - ${emojis.leave} [**Leave a Hub**](https://discord-interchat.github.io/docs/hub/leaving)
          - ✨ [**Create a Hub**](https://discord-interchat.github.io/docs/hub/management#creating-a-hub)
          - ${emojis.delete} [**Delete a Hub**](https://discord-interchat.github.io/docs/hub/management#deleting-a-hub)
          - 🛡️ [**Hub Moderators (Adding, Removing)**](https://discord-interchat.github.io/docs/hub/management#managing-hub-moderators)
          - 📝 [**Edit Hub**](https://discord-interchat.github.io/docs/hub/management#editing-your-hub)
          - ${emojis.settings} [**Hub Settings**](https://discord-interchat.github.io/docs/hub/management#hub-settings)
        `);

        await interaction.update({ embeds: [hubsEmbed] });
        break;
      }
      case 'network': {
        const networkEmbed = EmbedBuilder.from(templateEmbed).setDescription(stripIndents`
          ## The Network
          Network refers to the entire web of servers that are connected to a hub. In this area, you can send messages that will appear in other channels that have been set up on other servers.
            ### Network Guides
          - 🌎 [**What is the network?** (Coming Soon!)](https://discord-interchat.github.io/docs/hub/network)
          - ${emojis.connect} [**Using the network**](https://discord-interchat.github.io/docs/messaging#sending-messages)
          - ${emojis.settings} [**Network Settings (Coming soon!)**](https://discord-interchat.github.io/docs/hub/network#network-settings)
        `);

        await interaction.update({ embeds: [networkEmbed] });
        break;
      }

      case 'messaging': {
        const messagingEmbed = EmbedBuilder.from(templateEmbed).setDescription(stripIndents`
          ## Messaging
          Messaging refers to the ability to send messages to other servers within a hub. Find out how to send messages by visiting the guides below. You can also edit and delete messages that you have sent.
          ### Messaging Guides
          - 📨 [**Send Messages**](https://discord-interchat.github.io/docs/messaging#sending-messages)
          - ✏️ [**Edit Messages**](https://discord-interchat.github.io/docs/messaging#editing-messages)
          - ${emojis.delete} [**Delete Messages**](https://discord-interchat.github.io/docs/messaging#deleting-messages)
          - ${emojis.reply} [**Reply to Messages**](https://discord-interchat.github.io/docs/messaging#replying-to-messages)
          - 😂 [**React to Messages (Coming soon!)**](https://discord-interchat.github.io/docs/message/reacting)
          - ${emojis.wand} [**The InterChat Team (Coming Soon!)**](https://discord-interchat.github.io/docs/credits)
          - 📑 [**Report Messages**](https://discord-interchat.github.io/docs/messaging#reporting-messages--users)
        `);

        await interaction.update({ embeds: [messagingEmbed] });
        break;
      }

      case 'credits': {
        await interaction.deferUpdate();

        const members: User[] = [];
        const credits = getCredits();
        for (const credit of credits) {
          const shardValues = (await interaction.client.cluster.broadcastEval(
            `this.users.cache.get('${credit}')`,
            { context: { userId: credit } },
          )) as User[];

          const member =
            shardValues.find((m) => !!m) ?? (await interaction.client.users.fetch(credit));

          members.push(member);
        }

        const linksDivider = `${emojis.blueLine.repeat(9)} **LINKS** ${emojis.blueLine.repeat(9)}`;
        const creditsDivider = `${emojis.blueLine.repeat(9)} **TEAM** ${emojis.blueLine.repeat(9)}`;

        const creditsEmbed = EmbedBuilder.from(templateEmbed).setDescription(`
          ## ${emojis.wand} The Team
          InterChat is a project driven by a passionate team dedicated to enhancing the Discord experience. We welcome new members to join our team; if you're interested, please join our [support server](${URLs.SUPPORT_INVITE}). 

          ${creditsDivider}
          ${emojis.interchatCircle} **Design:** 
          ${emojis.dotBlue} @${members[6]?.username} (Mascot)
          ${emojis.dotBlue} @${members[4]?.username} (Avatar)
          ${emojis.dotBlue} @${members[0]?.username} (Avatar)
          ${emojis.dotBlue} @${members[5]?.username} (Avatar & Server Icon)

          ${emojis.botdev} **Developers:**
          ${emojis.dotBlue} @${members[1]?.username}
          ${emojis.dotBlue} @${members[2]?.username}
          ${emojis.dotBlue} @${members[0].username}

          ${emojis.staff} **Staff: ([Recruiting!](https://forms.gle/8zu7cxx4XPbEmMXJ9))**
          ${emojis.dotBlue} @${members[4]?.username}
          ${emojis.dotBlue} @${members[3]?.username}
          ${emojis.dotBlue} @${members[5]?.username}

          ${linksDivider}
          [Guide](https://discord-interchat.github.io/docs) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](${URLs.SUPPORT_INVITE}) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](https://discord-interchat.github.io/docs/legal/privacy) • [Terms](https://discord-interchat.github.io/docs/legal/terms) 
        `);

        await interaction.editReply({ embeds: [creditsEmbed] });
      }
    }
  }
}
