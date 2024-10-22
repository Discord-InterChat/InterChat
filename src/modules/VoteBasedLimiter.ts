import UserDbManager from '#main/managers/UserDbManager.js';
import { cacheData, getCachedData } from '#utils/CacheUtils.js';
import { RedisKeys } from '#main/config/Constants.js';

export default class VoteLimitManager {
  private readonly userManager;
  private readonly userId;
  private readonly limitObjKey;

  private readonly MAX_USES_WITHOUT_VOTE;
  private readonly CACHE_DURATION; // 12 hours

  constructor(
    limitObjKey: string,
    userId: string,
    userManager: UserDbManager,
    opts?: { maxUses?: number; cacheDuration?: number },
  ) {
    this.limitObjKey = limitObjKey;
    this.userId = userId;
    this.userManager = userManager;
    this.MAX_USES_WITHOUT_VOTE = opts?.maxUses ?? 3;
    this.CACHE_DURATION = opts?.cacheDuration ?? 43200; // 12 hours
  }

  public async getRemainingUses() {
    const { data, fromCache } = await getCachedData<{ usesLeft: string }>(
      `${RedisKeys.commandUsesLeft}:${this.limitObjKey}:${this.userId}`,
      null,
    );

    const usesLeft = isNaN(Number(data?.usesLeft)) ? null : Number(data?.usesLeft);

    return { usesLeft, fromCache };
  }

  public async setRemainingUses(remainingUses: number, expirySecs?: number) {
    return await cacheData(
      `${RedisKeys.commandUsesLeft}:${this.limitObjKey}:${this.userId}`,
      JSON.stringify({ usesLeft: remainingUses.toString() }),
      expirySecs,
    );
  }

  public async decrementUses() {
    const { usesLeft, fromCache } = await this.getRemainingUses();

    // Default to max edits if there's no data
    const newUsesCount = usesLeft !== null ? Math.max(usesLeft - 1, 0) : this.MAX_USES_WITHOUT_VOTE;

    // If from cache, don't overrite the duration
    const expirySecs = !fromCache ? this.CACHE_DURATION : undefined;
    await this.setRemainingUses(newUsesCount, expirySecs);

    return newUsesCount;
  }

  public async hasExceededLimit() {
    const { usesLeft, fromCache } = await this.getRemainingUses();

    if (!fromCache) {
      const dbUser = await this.userManager.getUser(this.userId);

      const voteExpirySecs =
        dbUser?.lastVoted && dbUser.lastVoted.getTime() > Date.now()
          ? Math.floor((dbUser.lastVoted.getTime() - Date.now()) / 1000)
          : null;

      await this.setRemainingUses(
        this.MAX_USES_WITHOUT_VOTE,
        voteExpirySecs || this.CACHE_DURATION,
      );
    }
    else if (usesLeft === 0) {
      const hasVoted = await this.userManager.userVotedToday(this.userId);
      return !hasVoted;
    }

    return false;
  }
}
