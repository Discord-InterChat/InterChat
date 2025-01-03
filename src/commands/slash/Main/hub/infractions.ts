import HubCommand from '#main/commands/slash/Main/hub/index.js';
import HubManager from '#main/managers/HubManager.js';
import InfractionManager from '#main/managers/InfractionManager.js';
import { Pagination } from '#main/modules/Pagination.js';
import { RemoveMethods } from '#main/types/Utils.js';
import { msToReadable } from '#main/utils/Utils.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import { buildInfractionListEmbeds } from '#utils/moderation/infractionUtils.js';
import { Infraction, UserData } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  BaseMessageOptions,
  Client,
  Collection,
  EmbedBuilder,
  Guild,
  time,
  User,
  type ChatInputCommandInteraction,
} from 'discord.js';

type InfractionType = 'server' | 'user';
type GroupedInfraction = Infraction & { user: UserData | null; count: number };

interface TargetInfo {
  name: string;
  iconURL: string;
}

export default class ViewInfractions extends HubCommand {
  private static readonly INFRACTIONS_PER_PAGE = 5;

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hub = await this.validateAndGetHub(interaction);
    if (!hub) return;

    const type = interaction.options.getString('type', true) as InfractionType;
    const targetId = interaction.options.getString('target');

    if (!targetId) {
      await this.showAllInfractions(interaction, hub, type);
      return;
    }

    await this.showTargetInfractions(interaction, hub, type, targetId);
  }

  private async validateAndGetHub(
    interaction: ChatInputCommandInteraction,
  ): Promise<HubManager | null> {
    const hubName = interaction.options.getString('hub', true);
    const hub = (await this.hubService.fetchModeratedHubs(interaction.user.id)).find(
      (h) => h.data.name === hubName,
    );

    if (!hub) {
      const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
      await this.replyEmbed(
        interaction,
        t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
      );
      return null;
    }

    return hub;
  }

  private async showTargetInfractions(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    type: InfractionType,
    targetId: string,
  ) {
    const targetInfo = await this.getTargetInfo(
      interaction.client,
      type,
      targetId,
      hub.data.iconUrl,
    );
    const infractionManager = new InfractionManager(type, targetId);
    const infractions = await infractionManager.getHubInfractions(hub.id);

    // Update target name if it's a server infraction
    const finalTargetName =
      infractionManager.targetType === 'user'
        ? targetInfo.name
        : (infractions.at(0)?.serverName ?? 'Unknown Server');

    const embeds = await buildInfractionListEmbeds(
      interaction.client,
      finalTargetName,
      infractions,
      type,
      targetInfo.iconURL,
    );

    await this.displayPagination(interaction, embeds);
  }

  private async getTargetInfo(
    client: Client,
    type: InfractionType,
    targetId: string,
    defaultIconURL: string,
  ): Promise<TargetInfo> {
    if (type === 'user') {
      const user = await client.users.fetch(targetId).catch(() => null);
      return {
        name: user?.username ?? 'Unknown User',
        iconURL: user?.displayAvatarURL() ?? defaultIconURL,
      };
    }
    return {
      name: 'Unknown',
      iconURL: defaultIconURL,
    };
  }

  private async showAllInfractions(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    type: InfractionType,
  ) {
    const Infractions = await this.getInfractions(hub.id);
    const embeds = await this.buildAllInfractionsEmbed(interaction.client, Infractions, type);
    await this.displayPagination(interaction, embeds);
  }

  private async getInfractions(hubId: string): Promise<Collection<string, GroupedInfraction>> {
    // Fetch all infractions in a single query with included relations
    const infractions = await db.infraction.findMany({
      where: { hubId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    // Group infractions by target ID
    return infractions.reduce((grouped, infraction) => {
      const targetId = this.getTargetId(infraction);
      const existing = grouped.get(targetId);

      if (!existing) {
        grouped.set(targetId, { ...infraction, count: 1 });
      }
      else {
        // Only update count since we're already sorted by date
        grouped.set(targetId, { ...existing, count: existing.count + 1 });
      }

      return grouped;
    }, new Collection<string, GroupedInfraction>());
  }

  private async buildAllInfractionsEmbed(
    client: Client,
    Infractions: Collection<string, GroupedInfraction>,
    type: InfractionType,
  ) {
    const pages: BaseMessageOptions[] = [];
    const targetIds = [...Infractions.keys()];

    // Batch fetch all users/servers at once
    const [targets, moderators] = await Promise.all([
      this.batchFetchTargets(client, targetIds, type),
      this.batchFetchModerators(client, [
        ...new Set(Infractions.map((i) => i.moderatorId).filter(Boolean) as string[]),
      ]),
    ]);

    let currentFields: { name: string; value: string }[] = [];
    let counter = 0;

    for (const [targetId, infraction] of Infractions) {
      const target = targets.get(targetId);
      const moderator = moderators.get(infraction.moderatorId ?? '') ?? null;

      const field = {
        name: `${this.getTargetName(target, infraction)} (${targetId}) (${time(infraction.createdAt, 'R')})`,
        value: this.formatInfractionDetails(
          infraction,
          moderator,
          this.formatExpirationTime(infraction.expiresAt),
        ),
      };

      currentFields.push(field);
      counter++;

      if (this.shouldCreateNewPage(counter, currentFields.length, Infractions.size)) {
        pages.push(this.createPageEmbed(currentFields));
        currentFields = [];
        counter = 0;
      }
    }

    return pages;
  }

  private async batchFetchTargets(client: Client, targetIds: string[], type: InfractionType) {
    const targets = new Collection<string, User | RemoveMethods<Guild>>();

    if (type === 'user') {
      const users = await Promise.all(
        targetIds.map((id) => client.users.fetch(id).catch(() => null)),
      );
      users.forEach((user, index) => {
        if (user) targets.set(targetIds[index], user);
      });
    }
    else {
      const guilds = await Promise.all(
        targetIds.map((id) => client.fetchGuild(id).catch(() => null)),
      );
      guilds.forEach((guild, index) => {
        if (guild) targets.set(targetIds[index], guild);
      });
    }

    return targets;
  }

  private async batchFetchModerators(client: Client, moderatorIds: string[]) {
    const moderators = new Collection<string, User>();

    const users = await Promise.all(
      moderatorIds.map((id) => client.users.fetch(id).catch(() => null)),
    );

    users.forEach((user, index) => {
      if (user) moderators.set(moderatorIds[index], user);
    });

    return moderators;
  }

  private getTargetName(
    target: User | RemoveMethods<Guild> | undefined,
    infraction: GroupedInfraction,
  ): string {
    if (!target) {
      return infraction.userId
        ? (infraction.user?.username ?? 'Unknown User')
        : (infraction.serverName ?? 'Unknown Server');
    }
    return target instanceof User ? target.username : target.name;
  }

  private getTargetId(infraction: Infraction): string {
    return infraction.userId ?? infraction.serverId ?? '';
  }

  private async createInfractionField(client: Client, infraction: GroupedInfraction) {
    const moderator = await this.fetchModerator(client, infraction.moderatorId);
    const expiresAt = this.formatExpirationTime(infraction.expiresAt);
    const targetInfo = await this.getTargetFieldInfo(client, infraction);

    return {
      name: `${targetInfo.name} (${targetInfo.id}) (${time(infraction.createdAt, 'R')})`,
      value: this.formatInfractionDetails(infraction, moderator, expiresAt),
    };
  }

  private async fetchModerator(client: Client, moderatorId: string | null) {
    if (!moderatorId) return null;
    return await client.users.fetch(moderatorId).catch(() => null);
  }

  private formatExpirationTime(expiresAt: Date | null): string {
    if (!expiresAt) return 'Never';

    return expiresAt > new Date()
      ? msToReadable(expiresAt.getTime() - Date.now())
      : `Expired at ${expiresAt.toLocaleDateString()}`;
  }

  private async getTargetFieldInfo(client: Client, infraction: GroupedInfraction) {
    const targetId = this.getTargetId(infraction);

    if (infraction.userId) {
      const user = await client.users.fetch(targetId).catch(() => null);
      return { name: user?.username ?? 'Unknown User', id: targetId };
    }

    const guild = await client.fetchGuild(targetId).catch(() => null);
    return {
      name: guild?.name ?? infraction.serverName ?? 'Unknown Server',
      id: targetId,
    };
  }

  private formatInfractionDetails(
    infraction: GroupedInfraction,
    moderator: User | null,
    expiresAt: string,
  ): string {
    return stripIndents`
      - **Total Infractions**: ${infraction.count}
      - **Latest Infraction**:
        > \`\`\`yaml
        > Type: ${infraction.type}
        > Status: ${infraction.status}
        > Reason: ${infraction.reason}
        > Moderator: ${moderator?.username ?? 'Unknown.'}
        > Expires: ${expiresAt}
        > \`\`\`
    `;
  }

  private shouldCreateNewPage(counter: number, fieldsLength: number, totalSize: number): boolean {
    return counter >= ViewInfractions.INFRACTIONS_PER_PAGE || fieldsLength === totalSize;
  }

  private createPageEmbed(fields: { name: string; value: string }[]) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('All Infractions for this hub')
          .setFields(fields)
          .setColor(Constants.Colors.invisible)
          .setFooter({
            text: 'To view a specific user or server\'s infractions, use the command with the target\'s ID.',
          }),
      ],
    };
  }

  private async displayPagination(
    interaction: ChatInputCommandInteraction,
    pages: BaseMessageOptions[],
  ) {
    const paginator = new Pagination(interaction.client).addPages(pages);
    await paginator.run(interaction);
  }
}
