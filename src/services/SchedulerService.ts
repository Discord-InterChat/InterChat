export default class Scheduler {
  private tasks: Map<string, { task: () => void; ms: number; timeout: NodeJS.Timeout }>;

  constructor() {
    this.tasks = new Map();
  }

  /**
   * Adds a recurring task to the scheduler.
   * @param taskName - The name of the task to add.
   * @param interval - The interval at which the task should be executed, in milliseconds or as a Date object.
   * @param task - The function to execute as the task.
   * @throws An error if a task with the same name already exists.
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
   * Adds a new task to the scheduler.
   * @param name - The name of the task.
   * @param ms - The number of milliseconds after which the task should be executed, or a Date object representing the time at which the task should be executed.
   * @param task - The function to be executed when the task is run.
   * @throws An error if a task with the same name already exists.
   */
  addTask(name: string, ms: number | Date, task: () => void): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name ${name} already exists.`);
    }

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
      clearTimeout(taskInfo.timeout);
      return this.tasks.delete(taskName);
    }
    return;
  }

  /**
   * Stop all currently running tasks
   */
  stopAllTasks(): void {
    this.tasks.forEach((_, taskName) => this.stopTask(taskName));
  }

  /**
   * Returns an array of currently running task names.
   */
  get taskNames(): string[] {
    return Array.from(this.tasks.keys());
  }
}