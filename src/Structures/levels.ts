import { getDb } from '../Utils/functions/utils';

export default class NetworkLeveling {
  private levelsDb = getDb().levels;
  constructor() {/**/}
  async setLevel(userId: string, level: number) {
    if (level < 0) level = 0;
    const userData = await this.levelsDb.findFirst({ where: { userId } });
    const xp = this.xpFor(level);

    if (!userData) return await this.levelsDb.create({ data: { userId, xp, level } });
    return await this.levelsDb.update({ where: { userId }, data: { level, xp } });
  }
  async setXp(userId: string, xp: number) {
    if (xp < 0) xp = 0;
    const level = Math.floor(0.1 * Math.sqrt(xp));
    const userData = await this.levelsDb.findFirst({ where: { userId } });

    if (!userData) return await this.levelsDb.create({ data: { userId, xp, level } });
    return await this.levelsDb.update({ where: { userId }, data: { xp, level } });
  }
  async addXp(userId: string, xp: number) {
    if (xp < 0) xp = 0;
    const userData = await this.levelsDb.findFirst({ where: { userId } });
    let level = Math.floor(0.1 * Math.sqrt(xp));

    if (userData) {
      const newXp = xp + userData.xp;
      level = Math.floor(0.1 * Math.sqrt(newXp));
      return await this.levelsDb.update({ where: { userId }, data: { xp: newXp, level } });
    }

    return this.levelsDb.create({ data: { userId, level, xp } });
  }
  async addLevel(userId: string, level: number) {
    if (level < 0) level = 0;
    const userData = await this.levelsDb.findFirst({ where: { userId } });
    let xp = this.xpFor(level);

    if (userData) {
      const newLevel = level + userData.level;
      xp = this.xpFor(level);

      return await this.levelsDb.update({ where: { userId }, data: { xp, level: newLevel } });
    }
    return await this.levelsDb.create({ data: { xp, level, userId } });
  }
  async getUser(userId: string) {
    return await this.levelsDb.findFirst({ where: { userId } });
  }
  async deleteUser(userId: string) {
    return await this.levelsDb.delete({ where: { userId } });
  }
  async getAllDocuments(options: {sortLevels?: 'asc' | 'desc', limit?: number}) {
    return await this.levelsDb.findMany({
      orderBy: options.sortLevels ? { level: options.sortLevels } : undefined,
      take: options.limit,
    });
  }
  /** XP required for advancing to the next level from level 0 */
  xpFor(level: number) {
    return Math.ceil((10 * (level ** 2)) / 0.1);
  }
  /** XP required for advancing to the next level from current level */
  requiredXp(level: number, xp: number) {
    const currentLevelXP = this.xpFor(level);
    const nextLevelXP = Math.ceil((10 * (level + 1) ** 2) / 0.1);
    const neededXp = nextLevelXP - currentLevelXP;
    const currentXp = xp - currentLevelXP;

    return { requiredXp: neededXp, currentXp };
  }
}
