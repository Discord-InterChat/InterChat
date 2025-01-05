import { RedisKeys } from '#utils/Constants.js';
import getRedis from '#utils/Redis.js';

/** Manage and store individual cooldowns */
export default class CooldownService {
  private readonly redisClient = getRedis();
  private readonly prefix = RedisKeys.cooldown;

  private getKey(id: string) {
    return `${this.prefix}:${id}`;
  }
  /**
   * Set a cooldown
   * @param id A unique id for the cooldown
   * @param ms The duration of the cooldown in milliseconds
   */
  public async setCooldown(id: string, ms: number) {
    await this.redisClient.set(this.getKey(id), Date.now() + ms, 'PX', ms);
  }

  /** Get a cooldown */
  public async getCooldown(id: string) {
    return Number.parseInt((await this.redisClient.get(this.getKey(id))) || '0');
  }

  /** Delete a cooldown */
  public async deleteCooldown(id: string) {
    await this.redisClient.del(this.getKey(id));
  }

  /** Get the remaining cooldown in milliseconds */
  public async getRemainingCooldown(id: string) {
    const cooldown = await this.getCooldown(id);
    return cooldown ? cooldown - Date.now() : 0;
  }
}
