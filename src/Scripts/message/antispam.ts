import { User, Collection } from 'discord.js';
import { cancelJob, scheduleJob } from 'node-schedule';
import { addUserBlacklist } from '../../Utils/functions/utils';

interface UserOpts {
  timestamps: number[];
  infractions: number;
}

const userCol = new Collection<string, UserOpts>();
const WINDOW_SIZE = 5000;
const MAX_STORE = 3;

export default function antiSpam(author: User): boolean {
  const userInCol = userCol.get(author.id);
  const currentTimestamp = Date.now();

  if (userInCol) {
    if (userInCol.infractions >= 3) {
      addUserBlacklist(author.client.user, author, 'Auto-blacklisted for spamming.', 60 * 5000); // blacklist for 5 minutes
      userCol.delete(author.id);
      return true;
    }

    const { timestamps } = userInCol;

    if (timestamps.length === MAX_STORE) {
      // Check if all the timestamps are within the window
      const oldestTimestamp = timestamps[0];
      const isWithinWindow = currentTimestamp - oldestTimestamp <= WINDOW_SIZE;

      userCol.set(author.id, {
        timestamps: [...timestamps.slice(1), currentTimestamp],
        infractions: isWithinWindow ? userInCol.infractions + 1 : userInCol.infractions,
      });
      setSpamTimers(author.id);
      return isWithinWindow ? true : false;
    }
  }

  userCol.set(author.id, {
    timestamps: userInCol ? [...userInCol.timestamps, currentTimestamp] : [currentTimestamp],
    infractions: 0,
  });
  setSpamTimers(author.id);
  return false;
}

export function setSpamTimers(userId: string): void {
  const five_min = 60 * 5000;
  const userInCol = userCol.get(userId);
  const lastMsgTimestamp = userInCol?.timestamps[userInCol.timestamps.length - 1];

  if (userInCol && lastMsgTimestamp && Date.now() - five_min <= lastMsgTimestamp) {
    cancelJob(`removeFromCol_${userId}`);
  }

  scheduleJob(`removeFromCol_${userId}`, new Date(Date.now() + five_min), () => {
    userCol.delete(userId);
  });
}