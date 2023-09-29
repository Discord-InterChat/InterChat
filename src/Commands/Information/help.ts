import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, Interaction, StringSelectMenuBuilder, EmbedBuilder, APISelectMenuOption, ApplicationCommandType, ComponentType, Client, chatInputApplicationCommandMention, User } from 'discord.js';
import { checkIfStaff, constants, getCredits } from '../../Utils/utils';
import { InterchatCommand } from '../../../typings/discord';
import emojis from '../../Utils/JSON/emoji.json';
import { stripIndents } from 'common-tags';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Want help? Here it comes!'),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(constants.colors.interchatBlue)
      .setThumbnail(interaction.client.user.avatarURL())
      .setFooter({ text: `Requested by @${interaction.user.username}`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL })
      .setDescription(stripIndents`
      ### InterChat Help
      InterChat is a powerful discord bot that enables effortless cross-server chatting! Get started by looking at the categories below.
      ### Categories:
      - ⚙️ [**Setting up InterChat**](https://discord-interchat.github.io/docs/setup)
      - ${emojis.normal.slashCommand}  [**All Commands**](https://discord-interchat.github.io/docs/category/commands)
      - 💬 [**Messaging & Network**](https://discord-interchat.github.io/docs/messaging)
      - 👥 [**Hubs**](https://discord-interchat.github.io/docs/hub/joining)
      `);

    const selects = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder({
        customId: 'guideSelect',
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
            label: 'Commands',
            value: 'commands',
            emoji: emojis.normal.slashCommand,
            description: 'View all of InterChat\'s commands.',
          },
          {
            label: 'The Team',
            value: 'credits',
            emoji: emojis.icons.wand,
            description: 'Learn more about the team behind InterChat!',
          },

        ],
        placeholder: 'Select a Category',
      }),
    );

    const firstReply = await interaction.reply({ embeds: [embed], components: [selects] });
    const collector = firstReply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      idle: 60000,
      componentType: ComponentType.StringSelect,
    });

    collector.on('collect', async (i) => {
      if (i.customId !== 'guideSelect') return;

      switch (i.values[0]) {
        case 'hubs': {
          const hubsEmbed = EmbedBuilder.from(embed)
            .setDescription(stripIndents`
            ## InterChat Hubs
            Think of hubs as your personal chat spaces, both creatable and joinable. They're like an exclusive room, where other servers can join to engage and chat together.

            ### Hub Guides
            - ${emojis.icons.join} [**Join a Hub**](https://discord-interchat.github.io/docs/hub/joining) 
            - ${emojis.icons.leave} [**Leave a Hub**](https://discord-interchat.github.io/docs/hub/leaving)
            - ✨ [**Create a Hub**](https://discord-interchat.github.io/docs/hub/management#creating-a-hub)
            - ${emojis.icons.delete} [**Delete a Hub**](https://discord-interchat.github.io/docs/hub/management#deleting-a-hub)
            - 🛡️ [**Hub Moderators (Adding, Removing)**](https://discord-interchat.github.io/docs/hub/management#managing-hub-moderators)
            - 📝 [**Edit Hub**](https://discord-interchat.github.io/docs/hub/management#editing-your-hub)
            - ${emojis.icons.settings} [**Hub Settings**](https://discord-interchat.github.io/docs/hub/management#hub-settings)
            `,
            );

          i.update({ embeds: [hubsEmbed] });
          break;
        }
        case 'network': {
          const networkEmbed = EmbedBuilder.from(embed)
            .setDescription(stripIndents`
            ## The Network
            Network refers to the entire web of servers that are connected to a hub. In this area, you can send messages that will appear in other channels that have been set up on other servers.
              ### Network Guides
            - 🌎 [**What is the network?** (Coming Soon!)](https://discord-interchat.github.io/docs/hub/network)
            - ${emojis.icons.connect} [**Using the network**](https://discord-interchat.github.io/docs/messaging#sending-messages)
            - ${emojis.icons.settings} [**Network Settings (Coming soon!)**](https://discord-interchat.github.io/docs/hub/network#network-settings)
            `);

          i.update({ embeds: [networkEmbed] });
          break;
        }

        case 'messaging': {
          const messagingEmbed = EmbedBuilder.from(embed)
            .setDescription(stripIndents`
            ## Messaging
            Messaging refers to the ability to send messages to other servers within a hub. Find out how to send messages by visiting the guides below. You can also edit and delete messages that you have sent.
            ### Messaging Guides
            - 📨 [**Send Messages**](https://discord-interchat.github.io/docs/messaging#sending-messages)
            - ✏️ [**Edit Messages**](https://discord-interchat.github.io/docs/messaging#editing-messages)
            - ${emojis.icons.delete} [**Delete Messages**](https://discord-interchat.github.io/docs/messaging#deleting-messages)
            - ${emojis.normal.reply} [**Reply to Messages**](https://discord-interchat.github.io/docs/messaging#replying-to-messages)
            - 😂 [**React to Messages (Coming soon!)**](https://discord-interchat.github.io/docs/message/reacting)
            - ${emojis.icons.wand} [**The InterChat Team (Coming Soon!)**](https://discord-interchat.github.io/docs/credits)
            - 📑 [**Report Messages**](https://discord-interchat.github.io/docs/messaging#reporting-messages--users)
            `);

          i.update({ embeds: [messagingEmbed] });
          break;
        }
        case 'commands': {
          await this.showCommands(i);
          break;
        }
        case 'credits': {
          await i.deferUpdate();
          const { normal, icons } = emojis;

          const members: User[] = [];
          const credits = await getCredits();
          for (const credit of credits) {
            const member = await i.client.users.fetch(String(credit));
            members.push(member);
          }

          const linksDivider = `${normal.blueLine.repeat(9)} **LINKS** ${normal.blueLine.repeat(9)}`;
          const creditsDivider = `${normal.blueLine.repeat(9)} **TEAM** ${normal.blueLine.repeat(9)}`;

          const creditsEmbed = EmbedBuilder.from(embed)
            .setDescription(`
              ## ${icons.wand} The Team
              InterChat is a project driven by a passionate team dedicated to enhancing the Discord experience. We welcome new members to join our team; if you're interested, please join our support server. 

              ${creditsDivider}
              ${normal.interchatCircle} **Design:** 
              ${normal.dotBlue} @${members[6]?.username} (Mascot)
              ${normal.dotBlue} @${members[4]?.username} (Avatar)
              ${normal.dotBlue} @${members[0]?.username} (Avatar)
              ${normal.dotBlue} @${members[5]?.username} (Avatar & Server Icon)
        
              ${icons.botdev} **Developers:**
              ${normal.dotBlue} @${members[1]?.username}
              ${normal.dotBlue} @${members[2]?.username}
              ${normal.dotBlue} @${members[0].username}
        
              ${icons.staff} **Staff: (Recruiting!)**
              ${normal.dotBlue} @${members[4]?.username}
              ${normal.dotBlue} @${members[3]?.username}
              ${normal.dotBlue} @${members[5]?.username}
        
              ${linksDivider}
              [Guide](https://discord-interchat.github.io/docs) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](https://discord.gg/6bhXQynAPs) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](https://discord-interchat.github.io/legal/privacy) • [Terms](https://discord-interchat.github.io/legal/terms) 
            `);

          await i.editReply({ embeds: [creditsEmbed] });
        }
      }
    });


  },
  async showCommands(interaction: Interaction) {
    if (!interaction.isRepliable()) return;

    await fetchAllCommands(interaction.client);

    const commands = interaction.client.commands;
    const isStaff = checkIfStaff(interaction.user.id);

    const ignoreDirs = isStaff ? [] : ['Developer', 'Staff'];
    const menuOptionsObj = commands.reduce((obj: Record<string, APISelectMenuOption>, command) => {
      if (!ignoreDirs.includes(command.directory) && !obj[command.directory]) {
        obj[command.directory] = { label: command.directory, value: command.directory };
      }
      return obj;
    }, {});

    const menuOptions = Object.values(menuOptionsObj);
    menuOptions[0].default = true;

    const categorySelect = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(new StringSelectMenuBuilder({ customId: 'categorySelect', options: menuOptions, placeholder: 'Select a Category' }));

    const firstCategory = menuOptions[0].label;
    let allCommands = '';

    commands.forEach(async command => {
      if (command.directory === firstCategory) {
        allCommands += prettifyHelp(command, interaction.client);
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(firstCategory + ' Commands')
      .setAuthor({ name: `${interaction.client.user.username} Help`, iconURL: interaction.client.user.avatarURL() || undefined })
      .setDescription(allCommands)
      .setColor(constants.colors.interchatBlue)
      .setFooter({ text: `Requested by @${interaction.user.username}`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });

    const firstReply = await interaction.reply({ embeds: [embed], components: [categorySelect], ephemeral: true, fetchReply: true });

    const collector = firstReply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      idle: 60000,
      componentType: ComponentType.StringSelect,
    });
    collector.on('collect', (i) => {
      if (i.customId === 'categorySelect') {
        const category = i.values[0];

        // reset values
        allCommands = '';
        commands.forEach((command) => {
          if (command.directory === category) {
            allCommands += prettifyHelp(command, interaction.client);
          }
        });

        const categoryEmbed = new EmbedBuilder()
          .setTitle(category + ' Commands')
          .setAuthor({ name: `${interaction.client.user.username} Help`, iconURL: interaction.client.user.avatarURL() || undefined })
          .setDescription(allCommands)
          .setColor(constants.colors.interchatBlue)
          .setFooter({ text: `Requested by @${interaction.user.username}`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });

        categorySelect.components[0].options.find(option => option.data.default)?.setDefault(false);
        categorySelect.components[0].options.find(option => option.data.value === category)?.setDefault(true);

        i.update({ embeds: [categoryEmbed], components: [categorySelect] });
      }
    });
  },
};

function getCommandDescription(command: InterchatCommand | undefined) {
  const commandData: any = command?.data;
  let description = command?.description;
  let commandType: ApplicationCommandType = commandData.type;

  if (!commandData?.type) {
    description = commandData.description;
    commandType = ApplicationCommandType.ChatInput;
  }

  return { description, commandType };
}

async function fetchAllCommands(client: Client) {
  const rawCommands = await client.application?.commands.fetch({ cache: true });
  return rawCommands;
}

function getCommandMention(commandName: string, client: Client) {
  const command = client.application?.commands.cache.find(({ name }) => name === commandName);
  return command?.type === ApplicationCommandType.ChatInput
    ? chatInputApplicationCommandMention(command.name, command.id)
    : commandName;
}

function prettifyHelp(command: InterchatCommand, client: Client) {
  const commandDesc = getCommandDescription(command);
  const commandType = commandDesc.commandType !== ApplicationCommandType.ChatInput ? ' ' + emojis.normal.contextMenu : emojis.normal.slashCommand;
  const commandMention = getCommandMention(command.data.name, client);

  return `${commandType} **${commandMention}**\n${emojis.normal.dividerEnd} ${commandDesc.description}\n`;
}
