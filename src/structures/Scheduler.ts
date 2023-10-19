export default class Scheduler {
  private tasks: Map<string, { task: () => void; ms: number; timeout: NodeJS.Timeout }>;

  constructor() {
    this.tasks = new Map();
  }

  addRecurringTask(name: string, ms: number | Date, task: () => void): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name ${name} already exists.`);
    }

    // if interval is instance of Date, convert it to milliseconds
    ms = ms instanceof Date ? ms.getTime() - Date.now() : ms;

    const intervalId = setInterval(task, ms);
    this.tasks.set(name, { task, ms, timeout: intervalId });
  }

  addTask(name: string, ms: number | Date, task: () => void): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name ${name} already exists.`);
    }

    // if interval is instance of Date, convert it to milliseconds
    ms = ms instanceof Date ? ms.getTime() - Date.now() : ms;

    const timeout = setTimeout(task, ms);
    this.tasks.set(name, { task, ms, timeout });
  }

  stopTask(taskName: string): boolean | undefined {
    const taskInfo = this.tasks.get(taskName);
    if (taskInfo) {
      clearInterval(taskInfo.timeout);
      return this.tasks.delete(taskName);
    }
    return;
  }
  stopAllTasks(): void {
    this.tasks.forEach((taskInfo, taskName) => {
      clearInterval(taskInfo.timeout);
      this.tasks.delete(taskName);
    });
  }

  get taskNames(): string[] {
    return Array.from(this.tasks.keys());
  }
}
