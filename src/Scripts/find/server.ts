import { ActionRowBuilder, SelectMenuBuilder, EmbedBuilder, ChatInputCommandInteraction, Guild, User, ComponentType } from 'discord.js';
import { stripIndents } from 'common-tags';
import emojis from '../../Utils/emoji.json';
import { getDb } from '../../Utils/functions/utils';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, option: string) {
		const database = getDb();
		const collection = database?.collection('connectedList');
		const foundByID: Guild | undefined = interaction.client.guilds.cache.get(option);


		if (!foundByID) {
			const foundByName = interaction.client.guilds.cache.filter((e) => e.name.toLowerCase()
				.replace(/[^A-Za-z0-9]/g, '')
				.includes(option.toLowerCase().replace(/[^A-Za-z0-9]/g, '')));
			// send the only result if there is one
			// if there is more than one result send the map with all the results
			if (foundByName.size > 1) {
				const mapFound = foundByName.map(e => {return { label: e.name, value: e.id };}).slice(0, 25);

				const menu = new ActionRowBuilder<SelectMenuBuilder>().addComponents([
					new SelectMenuBuilder()
						.setCustomId('servers')
						.setPlaceholder('🔎 Select a server')
						.addOptions(mapFound),
				]);

				const embed = new EmbedBuilder()
					.setTitle('Did you mean?')
					.setColor('#2F3136')
					.setDescription(foundByName.map((e) => `${e.name} (${e.id})`).slice(0, 10).join('\n'))
					.setFooter({
						text: 'Only showing 10 results. Use the drop down to see up to 25.',
						iconURL: interaction.client.user?.avatarURL()?.toString(),
					});

				const msg = await interaction.reply({
					embeds: [embed],
					components: [menu],
					ephemeral: true,
					fetchReply: true,
				});

				const collector = msg.createMessageComponentCollector({
					filter: m => m.user.id == interaction.user.id,
					idle: 30 * 1000,
					max: foundByName.size,
					componentType: ComponentType.SelectMenu,
				});
				collector.on('collect', async (i) => {
					const selectedGuild = foundByName.get(i.values[0]);

					if (!selectedGuild?.available) {
						i.reply('Could not find that server. Something went wrong!');
						return;
					}

					const owner = await interaction.client.users.fetch(selectedGuild?.ownerId);
					i.update({
						content: selectedGuild.id,
						embeds: [await embedGen(selectedGuild, owner)],
						components: [],
					});
					return;
				});

				collector.on('end', () => {
					interaction.editReply({ components: [] });
					return;
				});
			}

			else if (foundByName.size === 1) {
				await interaction.deferReply({ ephemeral: true });
				const selectedGuild = foundByName.first();
				const owner = await interaction.client.users.fetch(String(selectedGuild?.ownerId));
				interaction.followUp({
					content: selectedGuild?.id,
					embeds: [await embedGen(selectedGuild, owner)],
					ephemeral: true,
				});
			}
			else {
				interaction.reply({ content: 'Unknown server.', ephemeral: true });
				return;
			}
		}


		else {
			const server = foundByID;
			const owner = await interaction.client.users.fetch(server.ownerId);
			await interaction.reply({
				content: server.id,
				embeds: [await embedGen(server, owner)],
				ephemeral: true,
			});
			return;
		}


		// TODO: Emojis from external servers are not supported by discord anymore (works with followUps tho).
		async function embedGen(guild: Guild | undefined, owner: User) {
			const guildInDb = await collection?.findOne({ serverId: guild?.id });
			return new EmbedBuilder()
				.setAuthor({ name: String(guild?.name), iconURL: guild?.iconURL()?.toString() })
				.setColor('#2F3136')
				.addFields([
					{
						name: 'Server Info',
						value: stripIndents`\n
								${emojis.icons.owner} **Owner:** ${owner.username}#${owner.discriminator} (${owner.id})
								${emojis.icons.members} **Member Count:** ${guild?.memberCount}`,
					},
					{
						name: 'Network Info',
						value: stripIndents`\n
								${guildInDb ? emojis.icons.connect : emojis.icons.disconnect} **Connected: ${guildInDb ? 'Yes' : 'No'}**
								${emojis.normal.clipart} **Channel(s): ${guildInDb?.channelName || 'Not Connected'} (\`${guildInDb?.channelId || ':('}\`)**`,
					},
				]);
		}
	},
};