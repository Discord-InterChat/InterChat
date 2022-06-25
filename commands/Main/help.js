const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { colors, toTitleCase } = require('../../utils');
const bitfieldCalculator = require('discord-bitfield-calculator');

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
				.setDescription('[Invite](https://discord.com/api/oauth2/authorize?client_id=769921109209907241&permissions=154820537425&scope=bot%20applications.commands) • [Support](https://discord.gg/6bhXQynAPs) • [Privacy](https://gist.github.com/dev-737/0141970e0d4a09b3c2b11e1321dca824)')
				.setFields(interaction.client.help)
				.setFooter({ text: 'Requested By: ' + interaction.user.tag, iconURL: interaction.user.avatarURL({ dynamic: true }) })
				.setColor(colors('chatbot'))
				.setTimestamp();

			return await interaction.reply({ embeds: [embed] });
		}
		const command = interaction.client.commands.get(command_option);
		const commanddata = command.data.toJSON();
		const commandOps = commanddata.options;
		const permissions = bitfieldCalculator.permissions(command.data.default_member_permissions).toString().replace('_', ' ').replace(',', ', ');
		let options = '';

		if (!command) return interaction.reply('Unkown command!');

		const command_embed = new MessageEmbed()
			.setTitle(command.data.name.toTitleCase() + ' Help')
			.setDescription(command.data.description || command.description || 'No Description')
			.addFields([{ name: 'Permissions:', value: `**${ permissions || 'None'}**` }])
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