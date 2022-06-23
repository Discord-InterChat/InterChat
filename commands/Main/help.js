const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { colors } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Want help? Here it comes!')
		.addStringOption(option =>
			option
				.setName('command')
				.setRequired(false)
				.setDescription('Name of command')
				.setAutocomplete(true)),
	async execute(interaction) {
		const command_option = interaction.options.getString('command');
		if (!command_option) {
			const embed = new MessageEmbed()
				.setAuthor({ name: interaction.client.user.username + ' Help', iconURL: interaction.client.user.avatarURL() })
				.setFields(interaction.client.help)
				.setFooter({ text: 'Requested By: ' + interaction.user.tag, iconURL: interaction.user.avatarURL({ dynamic: true }) })
				.setColor(colors('chatbot'))
				.setTimestamp();

			return await interaction.reply({ embeds: [embed] });
		}
		const command = interaction.client.commands.get(command_option);
		const commanddata = command.data.toJSON();
		const commandOps = commanddata.options;

		let options = '';

		if (!command) return interaction.reply('Unkown command!');

		const command_embed = new MessageEmbed()
			.setTitle(command.data.name.toUpperCase() + ' Help')
			.setDescription(command.data.description || command.description || 'No Description')
			.setFooter({ text: '<> - Required | [] - Optional', iconURL: interaction.client.user.avatarURL })
			.setColor(colors());

		if (commandOps && commandOps[0]?.type != 1 && commandOps[0]?.type != 2) {
			commandOps.forEach((value) => value.required ? options += ` <${value.name}>` : options += ` [${value.name}]`);
			command_embed.addFields([
				{ name: 'Usage: ', value: `\`/${command.data.name + options}\`` },
			]);
		}

		if (commandOps && commandOps[0]?.type === 1) {
			commandOps.forEach((subcommand) => {
				const subOptions = subcommand.options.map((optionValue) => {
					return optionValue.required ? ` <${optionValue.name}>` : ` [${optionValue.name}]`;
				});

				const data = {
					name:  `${command.data.name} ${subcommand.name}`,
					value: `${subcommand.description || 'No Description'}\n**Usage: **\`/${command.data.name} ${subcommand.name}${subOptions.length === 0 ? '' : subOptions.join('')}\``,
				};

				command_embed.addFields([data]);
			});

		}


		return interaction.reply({ embeds: [command_embed] });
	},
};