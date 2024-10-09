import { emojis, RedisKeys } from '#main/config/Constants.js';
import { getCachedData } from '#utils/cache/cacheUtils.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { HubLogConfig, Prisma } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, roleMention, Snowflake, StringSelectMenuBuilder } from 'discord.js';

export type RoleIdLogConfigs = 'appeals' | 'reports';
export type LogConfigTypes = keyof Omit<Omit<HubLogConfig, 'hubId'>, 'id'>;
export const logsWithRoleId = ['appeals', 'reports'];

const channelMention = (channelId: string | null | undefined) =>
  channelId ? `<#${channelId}>` : emojis.no;

export default class HubLogManager {
  private readonly hubId: string;
  private logConfig: HubLogConfig;
  readonly logsWithRoleId = logsWithRoleId;
  readonly logTypes: LogConfigTypes[];

  constructor(logConfig: HubLogConfig) {
    this.hubId = logConfig.hubId;
    this.logConfig = logConfig;
    this.logTypes = Object.keys(logConfig).filter(
      (key) => key !== 'hubId' && key !== 'id',
    ) as LogConfigTypes[];
  }

  static async create(hubId: string) {
    const logConfig = await getCachedData(
      `${RedisKeys.hubLogConfig}:${hubId}`,
      async () =>
        await db.hubLogConfig.upsert({
          where: { hubId },
          create: { hubId },
          update: { hubId },
        }),
    );

    return new HubLogManager(logConfig.data as HubLogConfig);
  }

  get config() {
    return this.logConfig;
  }

  protected async updateLogConfig(data: Prisma.HubLogConfigUpdateInput) {
    const updated = await db.hubLogConfig.update({ where: { hubId: this.hubId }, data });
    this.logConfig = updated;
  }

  async setLogChannel(type: LogConfigTypes, channelId: string) {
    if (this.logsWithRoleId.includes(type)) {
      await this.updateLogConfig({
        [type]: { upsert: { set: { channelId }, update: { channelId } } },
      });
      return;
    }

    await this.updateLogConfig({ [type]: channelId });
  }

  async resetLog(...type: LogConfigTypes[]) {
    await this.updateLogConfig(type.reduce((acc, typ) => ({ ...acc, [typ]: { unset: true } }), {}));
  }

  async setRoleId(type: RoleIdLogConfigs, roleId: string) {
    if (!this.config[type]?.channelId) throw new Error('Channel ID must be set before .');

    await this.updateLogConfig({
      [type]: {
        upsert: { set: { roleId, channelId: this.config[type].channelId }, update: { roleId } },
      },
    });
  }

  async removeRoleId(type: RoleIdLogConfigs) {
    if (!this.config[type]) return await this.resetLog(type);

    await this.updateLogConfig({
      appeals: { set: { channelId: this.config[type].channelId } },
    });
  }

  async setChannelAndRole(type: LogConfigTypes, channelId: string, roleId: string) {
    if (!this.logsWithRoleId.includes(type)) return;

    await this.setLogChannel(type, channelId);
    await this.setRoleId(type as RoleIdLogConfigs, roleId);
  }

  public createEmbed(iconUrl: string | null, locale: supportedLocaleCodes = 'en') {
    const channelStr = t('hub.manage.logs.config.fields.channel', locale);
    const roleStr = t('hub.manage.logs.config.fields.role', locale);

    const logDesc = this.logTypes
      .map((type) => {
        const configType = this.config[type];
        const roleInfo = this.logsWithRoleId.includes(type)
          ? `${emojis.dividerEnd} ${roleStr} ${typeof configType !== 'string' && configType?.roleId ? roleMention(configType.roleId) : emojis.no}`
          : '';

        return stripIndents`
          ${emojis.arrow} \`${type}:\`
          ${emojis.divider} ${t(`hub.manage.logs.${type}.description`, locale)}
          ${roleInfo ? emojis.divider : emojis.dividerEnd} ${channelStr} ${channelMention(typeof configType === 'string' ? configType : configType?.channelId)}
          ${roleInfo}`;
      })
      .join('\n');

    return new InfoEmbed()
      .removeTitle()
      .setDescription(`## ${t('hub.manage.logs.title', locale)}\n\n${logDesc}`)
      .setThumbnail(iconUrl);
  }

  public createSelectMenu(userId: Snowflake, hubId: string, locale: supportedLocaleCodes) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_edit', 'logsSelect')
            .addArgs(userId)
            .addArgs(hubId)
            .toString(),
        )
        .setPlaceholder('Choose a log type to set a channel.')
        .addOptions([
          {
            label: t('hub.manage.logs.reports.label', locale),
            value: 'reports',
            description: t('hub.manage.logs.reports.description', locale),
            emoji: '📢',
          },
          {
            label: t('hub.manage.logs.modLogs.label', locale),
            value: 'modLogs',
            description: t('hub.manage.logs.modLogs.description', locale),
            emoji: '👮',
          },
          {
            label: t('hub.manage.logs.profanity.label', locale),
            value: 'profanity',
            description: t('hub.manage.logs.profanity.description', locale),
            emoji: '🤬',
          },
          {
            label: t('hub.manage.logs.joinLeaves.label', locale),
            value: 'joinLeaves',
            description: t('hub.manage.logs.joinLeaves.description', locale),
            emoji: '👋',
          },
          {
            label: 'Appeals',
            value: 'appeals',
            description: 'Appeals from users/servers who have been blacklisted.',
            emoji: '📝',
          },
        ]),
    );
  }
}
