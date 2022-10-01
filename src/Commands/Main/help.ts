import { SlashCommandBuilder, ApplicationCommandOptionType, PermissionsBitField, EmbedBuilder, ChatInputCommandInteraction, SlashCommandStringOption, SlashCommandUserOption, PermissionsString, AutocompleteInteraction } from 'discord.js';
import { colors } from '../../Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Want help? Here it comes!')
		.addStringOption((option) =>
			option
				.setName('command')
				.setRequired(false)
				.setDescription('Name of command')
				.setAutocomplete(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const command_option = interaction.options.getString('command');

		if (!command_option) {
			const embed = new EmbedBuilder()
				.setAuthor({
					name: interaction.client.user?.username + ' Help',
					iconURL: interaction.client.user?.avatarURL() as string,
				})
				.setDescription(
					'[Invite](https://discord.com/api/oauth2/authorize?client_id=769921109209907241&permissions=154820537425&scope=bot%20applications.commands) • [Support](https://discord.gg/6bhXQynAPs) • [Privacy](https://gist.github.com/dev-737/0141970e0d4a09b3c2b11e1321dca824)',
				)
				.setFields(interaction.client.help)
				.setFooter({
					text: 'Requested By: ' + interaction.user.tag,
					iconURL: interaction.user.avatarURL() as string,
				})
				.setColor(colors('chatbot'))
				.setTimestamp();

			return await interaction.reply({ embeds: [embed] });
		}


		const command = interaction.client.commands.get(command_option);
		const commanddata = command?.data.toJSON();
		const commandOps = commanddata?.options;
		const permissions = new PermissionsBitField(commanddata?.default_member_permissions as PermissionsString | undefined)
			.toArray()
			.toString()
			.replace(',', ', ');
		let options = '';

		if (!command) return interaction.reply('Unkown command!');

		const command_embed = new EmbedBuilder()
			.setTitle(command.data.name.toTitleCase() + ' Help')
			.setDescription(
				command.data.description || command.description as string || 'No Description',
			)
			.addFields([
				{ name: 'Permissions:', value: `**${permissions || 'None'}**` },
			])
			.setFooter({
				text: '<> - Required | [] - Optional',
				iconURL: interaction.client.user?.avatarURL() as string,
			})
			.setColor(colors());


		if (
			commandOps &&
			commandOps[0]?.type != ApplicationCommandOptionType.Subcommand &&
			commandOps[0]?.type != ApplicationCommandOptionType.SubcommandGroup
		) {
			commandOps.forEach((value) =>
				value.required ? options += ` <${value.name}>` : options += ` [${value.name}]`,
			);
			command_embed.addFields([
				{ name: 'Usage: ', value: `\`/${command.data.name + options}\`` },
			]);
		}

		if (commandOps && commandOps[0]?.type === ApplicationCommandOptionType.Subcommand) {
			commandOps.forEach((subcommand: any) => {
				const subOptions = subcommand.options.map((optionValue: SlashCommandStringOption|SlashCommandUserOption) => {
					return optionValue.required ? ` <${optionValue.name}>` : ` [${optionValue.name}]`;
				});

				const data = {
					name: `${subcommand.name}`,
					value: `${subcommand.description || 'No Description'}\n**Usage: **\`/${command.data.name} ${subcommand.name}${
						subOptions.length === 0 ? '' : subOptions.join('')}\``,
				};

				command_embed.addFields([data]);
			});
		}

		return interaction.reply({ embeds: [command_embed] });
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		const focusedValue = interaction.options.getFocused();
		let choices: any[] = [];
		let filtered;

		if (focusedValue === '') {
			choices = [
				{ name: '📌Setup', value: 'setup' },
				{ name: '📌Help', value: 'help' },
				{ name: '📌Suggest', value: 'support' },
				{ name: '📌Report', value: 'support' },
				{ name: '📌Connect', value: 'network' },
				{ name: '📌Disconnect', value: 'network' },
			];
			choices = choices.concat(interaction.client.commands.map(command => { return { name: command.data.name, value: command.data.name };}));
			filtered = choices.filter((choice) => choice.value.startsWith(focusedValue)).slice(0, 25);
		}
		else {
			const commands = interaction.client.commands;
			commands.map((command) => choices.push(command.data.name));
			filtered = choices.filter((choice) => choice.startsWith(focusedValue));
		}

		await interaction.respond(
			filtered.map((choice) => ({
				name: choice.name || choice,
				value: choice.value || choice,
			})),
		);

	},
};
