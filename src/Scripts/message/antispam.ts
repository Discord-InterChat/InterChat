import { User, Collection } from 'discord.js';
import { cancelJob, scheduleJob } from 'node-schedule';
interface UserOpts {
  timestamps: number[];
  infractions: number;
}

const userCol = new Collection<string, UserOpts>();
const WINDOW_SIZE = 5000;
const MAX_STORE = 3;

export default {
  execute(author: User, maxInfractions = MAX_STORE) {
    const userInCol = userCol.get(author.id);
    const currentTimestamp = Date.now();

    if (userInCol) {
      if (userInCol.infractions >= maxInfractions) {
      // resetting count as it is assumed they will be blacklisted right after
        userCol.delete(author.id);
        return userInCol;
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
        if (isWithinWindow) return userInCol;
      }

      else {
        userCol.set(author.id, {
          timestamps: [...timestamps, currentTimestamp],
          infractions: userInCol.infractions,
        });
      }
    }

    else {
      userCol.set(author.id, {
        timestamps: [currentTimestamp],
        infractions: 0,
      });
      setSpamTimers(author.id);
    }
  },
};

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