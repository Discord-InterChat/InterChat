import { HubSettingsBits } from '#main/modules/BitFields.js';
import { deleteConnections } from '#main/utils/ConnectedListUtils.js';
import Constants from '#main/utils/Constants.js';
import { PrismaClient } from '@prisma/client';

export interface HubCreationData {
  name: string;
  description: string;
  iconUrl?: string;
  bannerUrl?: string;
  ownerId: string;
}

export class HubService {
  private readonly db: PrismaClient;
  constructor(db: PrismaClient) {
    this.db = db;
  }

  async fetchHub(id: string) {
    return await this.db.hub.findFirst({ where: { id } });
  }

  async createHub(data: HubCreationData): Promise<void> {
    await this.db.hub.create({
      data: {
        ...data,
        private: true,
        iconUrl: data.iconUrl ?? Constants.Links.EasterAvatar,
        bannerUrl: data.bannerUrl ?? null,
        settings:
          HubSettingsBits.SpamFilter | HubSettingsBits.Reactions | HubSettingsBits.BlockNSFW,
      },
    });
  }

  async deleteHub(hubId: string): Promise<void> {
    // delete all relations first and then delete the hub
    await deleteConnections({ hubId });
    await this.db.$transaction([
      this.db.hubInvite.deleteMany({ where: { hubId } }),
      this.db.hubLogConfig.deleteMany({ where: { hubId } }),
      this.db.messageBlockList.deleteMany({ where: { hubId } }),
      this.db.userInfraction.deleteMany({ where: { hubId } }),
      this.db.serverInfraction.deleteMany({ where: { hubId } }),
    ]);

    // finally, delete the hub
    await this.db.hub.deleteMany({ where: { id: hubId } });
  }

  async getHubsForUser(userId: string) {
    return await this.db.hub.findMany({ where: { ownerId: userId } });
  }

  async getHubByName(name: string) {
    return await this.db.hub.findFirst({ where: { name } });
  }

  async getExistingHubs(ownerId: string, hubName: string) {
    return await this.db.hub.findMany({
      where: {
        OR: [{ ownerId }, { name: hubName }],
      },
    });
  }
}
