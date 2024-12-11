import HubManager from '#main/managers/HubManager.js';
import { HubSettingsBits } from '#main/modules/BitFields.js';
import { ConvertDatesToString } from '#main/types/Utils.js';
import { deleteConnections } from '#main/utils/ConnectedListUtils.js';
import Constants, { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import getRedis from '#main/utils/Redis.js';
import { Hub, Prisma, PrismaClient, Role } from '@prisma/client';
import { Redis } from 'ioredis';

export interface HubCreationData {
  name: string;
  description: string;
  iconUrl?: string;
  bannerUrl?: string;
  ownerId: string;
}

export class HubService {
  private readonly db: PrismaClient;
  private readonly cache: Redis;
  public readonly hubKey = `${RedisKeys.Hub}:`;

  constructor(_db: PrismaClient = db, cache = getRedis()) {
    this.db = _db;
    this.cache = cache;
  }

  protected serializeHub(hub: string): Hub {
    const parsedHub = JSON.parse(hub) as ConvertDatesToString<Hub>;

    return {
      ...parsedHub,
      createdAt: new Date(parsedHub.createdAt),
      updatedAt: new Date(parsedHub.updatedAt),
    };
  }

  private createHubManager(hub: Hub): HubManager;
  private createHubManager(hub: string): HubManager;
  private createHubManager(hub: Hub | string | null): HubManager | null;
  private createHubManager(hub: Hub | string | null) {
    if (typeof hub === 'string') return new HubManager(this.serializeHub(hub), this);
    if (hub) return new HubManager(hub);
    return null;
  }

  async fetchHub(id: string): Promise<HubManager | null>;
  async fetchHub(where: { id: string }): Promise<HubManager | null>;
  async fetchHub(where: { name: string }): Promise<HubManager | null>;
  async fetchHub(whereInput: string | { id?: string; name?: string }): Promise<HubManager | null> {
    const where: { id?: string; name?: string } = typeof whereInput === 'string'
      ? { id: whereInput }
      : whereInput;

    if (!where.id && !where.name) {
      return null;
    }

    // Check cache if we have an ID
    if (where.id) {
      const fromCache = await this.cache.get(`${this.hubKey}${where.id}`);
      if (fromCache) {
        return this.createHubManager(fromCache);
      }
    }

    const hub = await this.db.hub.findFirst({ where });

    // Cache result if we found something
    if (hub) {
      await this.cache.set(`${this.hubKey}${hub.id}`, JSON.stringify(hub));
      return this.createHubManager(hub);
    }

    return null;
  }

  async createHub(data: HubCreationData): Promise<HubManager> {
    const hub = await this.db.hub.create({
      data: {
        ...data,
        moderators: { create: { userId: data.ownerId, role: 'OWNER' } },
        private: true,
        iconUrl: data.iconUrl ?? Constants.Links.EasterAvatar,
        bannerUrl: data.bannerUrl ?? null,
        settings:
          HubSettingsBits.SpamFilter | HubSettingsBits.Reactions | HubSettingsBits.BlockNSFW,
      },
    });

    return this.createHubManager(hub);
  }

  async deleteHub(hubId: string): Promise<void> {
    // delete all relations first and then delete the hub
    await deleteConnections({ hubId });
    await this.db.$transaction([
      this.db.hubInvite.deleteMany({ where: { hubId } }),
      this.db.hubLogConfig.deleteMany({ where: { hubId } }),
      this.db.blockWord.deleteMany({ where: { hubId } }),
      this.db.infraction.deleteMany({ where: { hubId } }),
    ]);

    // finally, delete the hub
    await this.db.hub.delete({ where: { id: hubId } });
  }

  async getOwnedHubs(userId: string) {
    const hubs = await this.db.hub.findMany({ where: { ownerId: userId } });
    return hubs.map((hub) => this.createHubManager(hub));
  }

  async findHubsByName(
    name: string,
    opts?: { insensitive?: boolean; ownerId?: string; take?: number },
  ): Promise<HubManager[]> {
    const hubs = await this.db.hub.findMany({
      where: {
        name: {
          mode: opts?.insensitive ? 'insensitive' : 'default',
          contains: name,
        },
        ownerId: opts?.ownerId,
      },
      take: opts?.take,
    });

    return hubs.map((hub) => this.createHubManager(hub));
  }

  async getExistingHubs(ownerId: string, hubName: string) {
    const hubs = await this.db.hub.findMany({
      where: { OR: [{ ownerId }, { name: hubName }] },
    });

    return hubs.map((hub) => this.createHubManager(hub));
  }

  async fetchModeratedHubs(
    userId: string,
    opts?: {
      roles?: Role[];
      filter?: Prisma.HubModeratorWhereInput;
      take?: number;
    },
  ) {
    const hubs = await this.db.hubModerator.findMany({
      where: {
        role: opts?.roles ? { in: [...opts.roles, 'OWNER'] } : undefined,
        ...opts?.filter,
        userId,
      },
      include: { hub: true },
      take: opts?.take,
    });

    return hubs.map(({ hub }) => this.createHubManager(hub));
  }
}
