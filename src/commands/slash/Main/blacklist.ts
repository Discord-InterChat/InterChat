import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import db from '../../../utils/Db.js';
import hubSelectMenu from '../../../scripts/hub/hubSelectMenu.js';
import { simpleEmbed } from '../../../utils/Utils.js';
import { stripIndents } from 'common-tags';
import { emojis } from '../../../utils/Constants.js';
import { t } from '../../../utils/Locale.js';

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'blackli',
    description: 'Stop a user or server from talking in your hub.',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'hub',
        description: 'The name of the hub you wish to use.',
        autocomplete: true,
        required: false,
      },
      {
        type: ApplicationCommandOptionType.User,
        name: 'user',
        description: 'The user you wish to blacklist.',
        required: false,
      },
      {
        type: ApplicationCommandOptionType.User,
        name: 'serverid',
        description: 'The ID of the server you wish to blacklist.',
        required: false,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getUser('user');
    const serverId = interaction.options.getString('hub');
    const hubName = interaction.options.getString('hub') ?? undefined;


    if (!user && !serverId) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.no} Please input atleast a user or server ID to blacklist.`)],
        ephemeral: true,
      });
      return;
    }

    const type = user ? 'user' : serverId ? 'server' : 'both';

    if (type === 'server' && serverId) {
      const server = await interaction.client.fetchGuild(serverId);
      if (!server) {
        await interaction.reply({
          content: t(
            { phrase: 'errors.unknownServer', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
          ephemeral: true,
        });
      }
    }

    const filteredHubs = await db.hubs.findMany({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id } } },
        ],
      },
    });

    if (filteredHubs.length > 1) {
      const hubSelect = hubSelectMenu(filteredHubs, { prefix: 'blacklist', postfix: 'hubId' });
      await interaction.reply({
        embeds: [
          simpleEmbed(stripIndents`
            ### Choose a Hub
            You own/moderate more than one hub. Please choose the hub you want to blacklist this user/server from. 
        `),
        ],
        components: [hubSelect],
        ephemeral: true,
      });
      return;
    }
  }
}
