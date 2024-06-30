import { hubBlacklist } from '@prisma/client';
import { Collection, Snowflake } from 'discord.js';
import Scheduler from '../services/SchedulerService.js';
import SuperClient from './Client.js';
import { handleError } from '../utils/Utils.js';

interface BlacklistEntity {
  id: string;
  blacklistedFrom: hubBlacklist[];
}

export default abstract class BaseBlacklistManager<T extends BlacklistEntity> {
  protected scheduler = new Scheduler();
  protected cache = new Collection<string, T>();

  constructor() {
    this.scheduler.addRecurringTask('unblacklistEntities', 10_000, () =>
      this.removeStaleBlacklists(),
    );
    this.scheduler.addRecurringTask('cacheEntityBlacklist', 60 * 60 * 1000, () =>
      this.cacheSoonExpiring(),
    );
  }

  protected abstract fetchExpiringEntities(): Promise<T[]>;
  protected abstract fetchEntityFromDb(hubId: string, entityId: string): Promise<T | null>;
  protected abstract logUnblacklist(client: SuperClient, hubId: string, id: string): Promise<void>;

  public abstract removeBlacklist(hubId: string, id: string): Promise<T | null>;
  public abstract addBlacklist(
    entity: { id: Snowflake; name: string },
    hubId: string,
    { reason, moderatorId, expires }: { reason: string; moderatorId: Snowflake; expires?: Date },
  ): Promise<T>;

  public async fetchBlacklist(hubId: string, entityId: string) {
    const data =
      this.cache.find(
        (v) => v.blacklistedFrom.some((h) => h.hubId === hubId) && v.id === entityId,
      ) ?? (await this.fetchEntityFromDb(hubId, entityId));

    if (data && !this.cache.has(data.id)) this.cache.set(data.id, data);

    return data;
  }

  private async cacheSoonExpiring() {
    const entities = await this.fetchExpiringEntities();
    entities.forEach((entity) => this.cache.set(entity.id, entity));
  }

  private removeStaleBlacklists() {
    const filter = ({ expires }: { expires: Date | null }) => expires && expires <= new Date();
    const entities = this.cache.filter((entity) => entity.blacklistedFrom.some(filter));
    if (entities?.size === 0) return;

    entities.forEach((entity) => {
      const blacklists = entity.blacklistedFrom.filter(filter);
      if (!blacklists) return;

      blacklists.forEach(async ({ hubId }) => {
        const client = SuperClient.instance;

        await this.logUnblacklist(client, hubId, entity.id).catch(handleError);
        await this.removeBlacklist(hubId, entity.id);
        this.cache.delete(entity.id);
      });
    });
  }
}
