import 'server-only';

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 20_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const AI_REQUEST_TIMEOUT_MS = positiveInteger(
  process.env.AI_REQUEST_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
);

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

const semaphore = new Semaphore(
  positiveInteger(process.env.AI_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY),
);

/** Bounds outbound AI work per server process so traffic spikes cannot fan out unchecked. */
export function withAiCapacity<T>(operation: () => Promise<T>): Promise<T> {
  return semaphore.run(operation);
}
