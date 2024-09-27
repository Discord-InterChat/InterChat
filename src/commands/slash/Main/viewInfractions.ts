import { emojis } from '#main/config/Constants.js';
import BaseCommand, { CmdData } from '#main/core/BaseCommand.js';
import ServerInfractionManager from '#main/modules/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/modules/InfractionManager/UserInfractionManager.js';
import { Pagination } from '#main/modules/Pagination.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import {
  buildInfractionListEmbeds,
  isServerInfraction,
} from '#main/utils/moderation/infractionUtils.js';
import { type ChatInputCommandInteraction, ApplicationCommandOptionType } from 'discord.js';

export default class ViewInfractions extends BaseCommand {
  data: CmdData = {
    name: 'viewinfractions',
    description: 'View all blacklisted users or servers in a hub.',
    options: [
      {
        name: 'hub',
        description: 'The hub to view infractions in.',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'type',
        description: 'The type of blacklist to view.',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: 'Server', value: 'server' },
          { name: 'User', value: 'user' },
        ],
      },
      {
        name: 'target',
        description: 'The user or server to view infractions for.',
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id } } },
        ],
      },
    });

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!hubInDb) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const type = interaction.options.getString('type', true) as 'server' | 'user';
    const targetId = interaction.options.getString('target', true);
    let targetName = 'Unknown.';
    let iconURL = hubInDb.iconUrl;

    let infractionManager;

    if (type === 'user') {
      infractionManager = new UserInfractionManager(targetId);

      const user = await interaction.client.users.fetch(targetId);
      targetName = user.username ?? 'Unknown User.';
      iconURL = user.displayAvatarURL();
    }
    else {
      infractionManager = new ServerInfractionManager(targetId);
    }

    const infractions = await infractionManager.getHubInfractions(hubInDb.id);
    targetName = isServerInfraction(infractions[0]) ? infractions[0].serverName : targetName;

    const embeds = await buildInfractionListEmbeds(
      interaction.client,
      targetName,
      infractions,
      type,
      iconURL,
    );

    const paginator = new Pagination().addPages(embeds);
    paginator.run(interaction);
  }
}
