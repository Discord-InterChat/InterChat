export class Scheduler {
  private tasks: Map<string, { task: () => void; interval: number; intervalId: NodeJS.Timeout }>;

  constructor() {
    this.tasks = new Map();
  }

  addTask(name: string, interval: number | Date, task: () => void): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name ${name} already exists.`);
    }

    // if interval is instance of Date, convert it to milliseconds
    interval = interval instanceof Date ? interval.getTime() - Date.now() : interval;

    const intervalId = setInterval(task, interval);
    this.tasks.set(name, { task, interval, intervalId });
  }

  stopTask(taskName: string): boolean | undefined {
    const taskInfo = this.tasks.get(taskName);
    if (taskInfo) {
      clearInterval(taskInfo.intervalId);
      return this.tasks.delete(taskName);
    }
    return;
  }
  stopAllTasks(): void {
    this.tasks.forEach((taskInfo, taskName) => {
      clearInterval(taskInfo.intervalId);
      this.tasks.delete(taskName);
    });
  }

  get taskNames(): string[] {
    return Array.from(this.tasks.keys());
  }
}
