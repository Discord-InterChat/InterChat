import { wait } from './Utils.js';

export default class DelayedQueue {
	private queue: (() => Promise<void>)[] = [];
	private isProcessing = false;
	private intervalMs: number;

	constructor(intervalMs = 1000) {
		this.intervalMs = intervalMs;
	}

	enqueue(action: () => void): void {
		const delayedAction = async () => {
			await wait(this.intervalMs);
			action();
		};

		this.queue.push(delayedAction);

		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	private async processQueue(): Promise<void> {
		if (this.queue.length === 0) {
			this.isProcessing = false;
			return;
		}

		this.isProcessing = true;
		const nextAction = this.queue.shift();
		if (nextAction) {
			await nextAction();
		}

		this.processQueue();
	}
	get size(): number {
		return this.queue.length;
	}
}
