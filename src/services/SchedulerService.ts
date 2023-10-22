export default class Scheduler {
  private tasks: Map<string, { task: () => void; ms: number; timeout: NodeJS.Timeout }>;

  constructor() {
    this.tasks = new Map();
  }

  /**
   * Add a recurring task (interval)
   * @param name The name of the task (must be unique)
   * @param ms The interval in milliseconds
   * @param task The function to execute every interval
   */
  addRecurringTask(name: string, ms: number | Date, task: () => void): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name ${name} already exists.`);
    }

    // if interval is instance of Date, convert it to milliseconds
    ms = ms instanceof Date ? ms.getTime() - Date.now() : ms;

    const intervalId = setInterval(task, ms);
    this.tasks.set(name, { task, ms, timeout: intervalId });
  }

  /**
   * Add a task (timeout)
   * @param name The name of the task (must be unique)
   * @param ms The interval in milliseconds
   * @param task The function to execute after the interval
   */
  addTask(name: string, ms: number | Date, task: () => void): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name ${name} already exists.`);
    }

    // if interval is instance of Date, convert it to milliseconds
    ms = ms instanceof Date ? ms.getTime() - Date.now() : ms;

    const timeout = setTimeout(task, ms);
    this.tasks.set(name, { task, ms, timeout });
  }

  /**
   * Stop a task by name, can be used for both recurring and timeout tasks
   * @param taskName The name of the task
   * @returns true if task was stopped, undefined if task was not found
   */
  stopTask(taskName: string): boolean | undefined {
    const taskInfo = this.tasks.get(taskName);
    if (taskInfo) {
      clearInterval(taskInfo.timeout);
      return this.tasks.delete(taskName);
    }
    return;
  }

  /**
   * Stop all tasks
   * @returns void
   */
  stopAllTasks(): void {
    this.tasks.forEach((taskInfo, taskName) => {
      clearInterval(taskInfo.timeout);
      this.tasks.delete(taskName);
    });
  }

  /**
   * Get all currently running task names
   * @returns An array of task names
   */
  get taskNames(): string[] {
    return Array.from(this.tasks.keys());
  }
}
