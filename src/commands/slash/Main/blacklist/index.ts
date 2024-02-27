import {
	ApplicationCommandOptionType,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	Collection,
	RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { escapeRegexChars, handleError } from '../../../../utils/Utils.js';
import BaseCommand from '../../../../core/BaseCommand.js';
import db from '../../../../utils/Db.js';

export default class BlacklistCommand extends BaseCommand {
	// TODO: Put this in readme
	static readonly subcommands = new Collection<string, BaseCommand>();

	readonly data: RESTPostAPIApplicationCommandsJSONBody = {
		name: 'blacklist',
		description: 'Blacklist a user or server from a hub.',
		options: [
			{
				type: ApplicationCommandOptionType.SubcommandGroup,
				name: 'add',
				description: 'Add blacklist',
				options: [
					{
						type: ApplicationCommandOptionType.Subcommand,
						name: 'user',
						description: 'Blacklist a user from using your hub.',
						options: [
							{
								type: ApplicationCommandOptionType.String,
								name: 'hub',
								description: 'The name of the hub to blacklist the user from.',
								required: true,
								autocomplete: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'user',
								description:
                  'The user ID to blacklist. User tag also works if they are already cached.',
								required: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'reason',
								description: 'The reason for blacklisting the user.',
								required: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'duration',
								description: 'The duration of the blacklist. Eg. 1d, 1w, 1m, 1y',
								required: false,
							},
						],
					},
					{
						type: ApplicationCommandOptionType.Subcommand,
						name: 'server',
						description: 'Blacklist a server from using your hub.',
						options: [
							{
								type: ApplicationCommandOptionType.String,
								name: 'hub',
								description: 'The name of the hub to blacklist the server from.',
								required: true,
								autocomplete: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'server',
								description: 'The server ID to blacklist.',
								required: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'reason',
								description: 'The reason for blacklisting the server.',
								required: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'duration',
								description: 'The duration of the blacklist. Eg. 1d, 1w, 1m, 1y',
								required: false,
							},
						],
					},
				],
			},
			{
				type: ApplicationCommandOptionType.SubcommandGroup,
				name: 'remove',
				description: 'Remove a blacklist from your hub.',
				options: [
					{
						type: ApplicationCommandOptionType.Subcommand,
						name: 'user',
						description: 'Remove a user from the blacklist.',
						options: [
							{
								type: ApplicationCommandOptionType.String,
								name: 'hub',
								description: 'The name of the hub to blacklist the user from.',
								required: true,
								autocomplete: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'user',
								description: 'The user to remove from the blacklist. User tag also works.',
								required: true,
								autocomplete: true,
							},
						],
					},
					{
						type: ApplicationCommandOptionType.Subcommand,
						name: 'server',
						description: 'Remove a server from the blacklist.',
						options: [
							{
								type: ApplicationCommandOptionType.String,
								name: 'hub',
								description: 'The name of the hub to blacklist the user from.',
								required: true,
								autocomplete: true,
							},
							{
								type: ApplicationCommandOptionType.String,
								name: 'server',
								description: 'The server to remove from the blacklist.',
								required: true,
								autocomplete: true,
							},
						],
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'list',
				description: 'List all blacklists for your hub.',
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: 'hub',
						description: 'The name of the hub to blacklist the user from.',
						required: true,
						autocomplete: true,
					},
					{
						type: ApplicationCommandOptionType.String,
						name: 'type',
						description: 'The type of blacklist to list.',
						required: true,
						choices: [
							{ name: 'User', value: 'user' },
							{ name: 'Server', value: 'server' },
						],
					},
				],
			},
		],
	};

	async execute(interaction: ChatInputCommandInteraction) {
		const subCommandName = interaction.options.getSubcommand();
		const subcommand = BlacklistCommand.subcommands.get(subCommandName);

		return await subcommand?.execute(interaction).catch((e) => handleError(e, interaction));
	}

	async autocomplete(interaction: AutocompleteInteraction) {
		const action = interaction.options.getSubcommand() as 'user' | 'server';
		const focusedHub = interaction.options.get('hub');

		if (typeof focusedHub?.value !== 'string') return;

		if (focusedHub.focused) {
			const hub = await db.hubs.findMany({
				where: {
					name: { mode: 'insensitive', contains: escapeRegexChars(focusedHub.value) },
					OR: [
						{ ownerId: interaction.user.id },
						{ moderators: { some: { userId: interaction.user.id } } },
					],
				},
				take: 25,
			});

			const filtered = hub.map(({ name: hubName }) => ({ name: hubName, value: hubName }));
			return interaction.respond(filtered);
		}

		switch (action) {
			case 'user': {
				const userOpt = interaction.options.get('user');

				if (!userOpt?.focused || typeof userOpt.value !== 'string') return;
				const userHubMod = await db.hubs.findFirst({
					where: {
						name: focusedHub.value,
						OR: [
							{ ownerId: interaction.user.id },
							{ moderators: { some: { userId: interaction.user.id } } },
						],
					},
				});

				if (!userHubMod) return interaction.respond([]);

				const filteredUsers = await db.userData.findMany({
					where: {
						blacklistedFrom: { some: { hubId: userHubMod.id } },
						OR: [
							{ username: { mode: 'insensitive', contains: userOpt.value } },
							{ userId: { mode: 'insensitive', contains: userOpt.value } },
						],
					},
					take: 25,
				});

				const choices = filteredUsers.map((user) => {
					return { name: user.username ?? `Unknown User - ${user.userId}`, value: user.userId };
				});
				interaction.respond(choices);
				break;
			}

			case 'server': {
				const serverOpt = interaction.options.get('server', true);
				const serverHubMod = await db.hubs.findFirst({
					where: {
						name: focusedHub.value,
						OR: [
							{ ownerId: interaction.user.id },
							{ moderators: { some: { userId: interaction.user.id } } },
						],
					},
				});
				if (!serverOpt.focused || typeof serverOpt.value !== 'string' || !serverHubMod) return;

				const allServers = await db.blacklistedServers.findMany({
					where: {
						hubs: { some: { hubId: serverHubMod.id } },
						OR: [
							{ serverName: { mode: 'insensitive', contains: serverOpt.value } },
							{ serverId: { mode: 'insensitive', contains: serverOpt.value } },
						],
					},
					take: 25,
				});
				const choices = allServers.map(({ serverName, serverId }) => {
					return { name: serverName, value: serverId };
				});
				await interaction.respond(choices);
				break;
			}
		}
	}
}
