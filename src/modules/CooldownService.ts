import cacheClient from '#main/utils/cache/cacheClient.js';
import { RedisKeys } from '#main/config/Constants.js';

/** Manage and store individual cooldowns */
export default class CooldownService {
  private getKey(id: string) {
    return `${RedisKeys.cooldown}:${id}`;
  }
  /**
   * Set a cooldown
   * @param id A unique id for the cooldown
   * @param ms The duration of the cooldown in milliseconds
   */
  public async setCooldown(id: string, ms: number) {
    await cacheClient.set(this.getKey(id), Date.now() + ms, 'PX', ms);
  }

  /** Get a cooldown */
  public async getCooldown(id: string) {
    return parseInt((await cacheClient.get(this.getKey(id))) || '0');
  }

  /** Delete a cooldown */
  public async deleteCooldown(id: string) {
    await cacheClient.del(this.getKey(id));
  }

  /** Get the remaining cooldown in milliseconds */
  public async getRemainingCooldown(id: string) {
    const cooldown = await this.getCooldown(id);
    return cooldown ? cooldown - Date.now() : 0;
  }
}
