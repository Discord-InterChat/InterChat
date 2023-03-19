import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionsBitField, PermissionsString, APISelectMenuOption, Client, ApplicationCommandType } from 'discord.js';
import { checkIfStaff, colors, toTitleCase } from '../../Utils/functions/utils';
import { InterchatCommand } from '../../Utils/typings/discord';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Want help? Here it comes!'),
  async execute(interaction: ChatInputCommandInteraction) {
    const commands = interaction.client.commands;
    const emojis = interaction.client.emoji.normal;
    const isStaff = await checkIfStaff(interaction.user);

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

    const commandSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(new StringSelectMenuBuilder({ customId: 'commandSelect', placeholder: 'Select a Command from this category' }));

    const firstCategory = menuOptions[0].label;
    let allCommands = '';

    commands.forEach(command => {
      if (command.directory === firstCategory) {
        allCommands += prettifyCommand(command, emojis);
        commandSelect.components[0].addOptions({ label: toTitleCase(command.data.name), value: command.data.name });
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(firstCategory + ' Commands')
      .setAuthor({ name: `${interaction.client.user.username} Help`, iconURL: interaction.client.user.avatarURL() || undefined })
      .setDescription(allCommands)
      .setColor(colors('chatbot'))
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });

    const firstReply = await interaction.reply({ embeds: [embed], components: [categorySelect, commandSelect] });

    const collector = firstReply.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id });
    collector.on('collect', (i) => {
      if (i.isStringSelectMenu()) {
        switch (i.customId) {
          case 'categorySelect': {
            const category = i.values[0];

            // reset values
            allCommands = '';
            commandSelect.components[0].setOptions();

            commands.forEach((command) => {
              if (command.directory === category) {
                allCommands += prettifyCommand(command, emojis);
                commandSelect.components[0].addOptions({ label: toTitleCase(command.data.name), value: command.data.name });
              }
            });

            const categoryEmbed = new EmbedBuilder()
              .setTitle(category + ' Commands')
              .setAuthor({ name: `${interaction.client.user.username} Help`, iconURL: interaction.client.user.avatarURL() || undefined })
              .setDescription(allCommands)
              .setColor(colors('chatbot'))
              .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });

            categorySelect.components[0].options.find(option => option.data.default)?.setDefault(false);
            categorySelect.components[0].options.find(option => option.data.value === category)?.setDefault(true);

            i.update({ embeds: [categoryEmbed], components: [categorySelect, commandSelect] });
            break;
          }
          case 'commandSelect': {
            const commandName = i.values[0];
            const selectedCommand = commands.find(command => command.data.name === commandName);
            const commandData = selectedCommand?.data.toJSON();
            const permissions = new PermissionsBitField(commandData?.default_member_permissions as PermissionsString | undefined).toArray().join(', ');

            const commandEmbed = new EmbedBuilder()
              .setTitle(toTitleCase(commandName))
              .setDescription(`${getCommandDescription(selectedCommand).description}`)
              .setColor(colors('chatbot'))
              .addFields({ name: 'Permissions Required', value: permissions || 'None.' });

            i.update({ embeds: [commandEmbed] });
            break;
          }

          default:
            break;
        }
      }

    });
  },
};

function getCommandDescription(command: InterchatCommand | undefined) {
  const commandData = command?.data as any;
  let description = command?.description;
  let commandType: ApplicationCommandType = commandData.type;

  if (!commandData.type) {
    description = commandData.description;
    commandType = ApplicationCommandType.ChatInput;
  }

  return { description, commandType };
}

function prettifyCommand(command: InterchatCommand, emojis: Client['emoji']['normal']) {
  const commandDesc = getCommandDescription(command);
  const commandType = commandDesc.commandType !== ApplicationCommandType.ChatInput ? ' ' + emojis.contextMenu : emojis.slashCommand;

  return `${commandType} **${toTitleCase(command.data.name)}**\n${emojis.dividerEnd} ${commandDesc.description}\n`;
}