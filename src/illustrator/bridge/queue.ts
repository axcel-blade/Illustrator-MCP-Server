import { McpDesignError } from "../../utils/errors.js";

/**
 * Serial operation queue. Illustrator's scripting engine is single-threaded and concurrent
 * scripts can corrupt document state, so every bridge call runs strictly one at a time.
 */
export class OperationQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  constructor(private readonly maxPending = 100) {}

  get size(): number {
    return this.pending;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.pending >= this.maxPending) {
      return Promise.reject(new McpDesignError("BRIDGE_UNAVAILABLE", `Operation queue is full (${this.maxPending} pending).`));
    }
    this.pending++;
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.pending--;
    });
  }
}
