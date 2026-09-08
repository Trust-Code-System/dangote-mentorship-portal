import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:3002').replace(
  /\/$/,
  '',
);
const stages = (process.env.VUS_STAGES ?? '5,10,25,50,100,200')
  .split(',')
  .map(Number)
  .filter((value) => Number.isFinite(value) && value > 0);
const stageSeconds = Number(process.env.STAGE_SECONDS ?? 10);
const routes = ['/', '/about', '/faq', '/login'];

if (
  !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl) &&
  process.env.ALLOW_REMOTE_LOAD !== 'true'
) {
  throw new Error(
    'Remote load testing is disabled. Use a local BASE_URL or explicitly set ALLOW_REMOTE_LOAD=true.',
  );
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

async function request(route) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'manual',
      headers: { 'user-agent': 'blak-moh-capacity-audit/1.0' },
    });
    await response.arrayBuffer();
    return {
      route,
      status: response.status,
      durationMs: performance.now() - started,
    };
  } catch (error) {
    return {
      route,
      status: 0,
      durationMs: performance.now() - started,
      error: error instanceof Error ? error.name : 'RequestError',
    };
  }
}

async function stage(vus) {
  const deadline = performance.now() + stageSeconds * 1000;
  const results = [];
  let sequence = 0;
  const workers = Array.from({ length: vus }, async () => {
    while (performance.now() < deadline) {
      const route = routes[sequence++ % routes.length];
      results.push(await request(route));
    }
  });
  const started = performance.now();
  await Promise.all(workers);
  const elapsedSeconds = (performance.now() - started) / 1000;
  const durations = results.map((result) => result.durationMs);
  const errors = results.filter(
    (result) => result.status < 200 || result.status >= 400,
  );
  return {
    vus,
    durationSeconds: Number(elapsedSeconds.toFixed(2)),
    requests: results.length,
    requestsPerSecond: Number((results.length / elapsedSeconds).toFixed(2)),
    latencyMs: {
      p50: Number(percentile(durations, 0.5).toFixed(1)),
      p95: Number(percentile(durations, 0.95).toFixed(1)),
      p99: Number(percentile(durations, 0.99).toFixed(1)),
      max: Number(Math.max(...durations).toFixed(1)),
    },
    errors: errors.length,
    errorRate: Number((errors.length / Math.max(results.length, 1)).toFixed(5)),
    statusCounts: Object.fromEntries(
      [...new Set(results.map((result) => result.status))].map((status) => [
        status,
        results.filter((result) => result.status === status).length,
      ]),
    ),
  };
}

const health = await fetch(`${baseUrl}/api/health`).then(async (response) => ({
  status: response.status,
  body: await response.json(),
}));
if (health.status !== 200 || health.body?.db !== 'up') {
  throw new Error('Readiness probe failed; refusing to begin the load test.');
}

const output = {
  capturedAt: new Date().toISOString(),
  target: baseUrl,
  scope: 'Local production server; anonymous, read-only public routes only',
  thresholds: { errorRate: '<1%', p95Ms: '<2000', p99Ms: '<4000' },
  healthBefore: { status: health.status, db: health.body.db },
  stages: [],
};

for (const vus of stages) {
  const result = await stage(vus);
  output.stages.push(result);
  console.log(JSON.stringify(result));
  if (
    result.errorRate >= 0.01 ||
    result.latencyMs.p95 >= 2000 ||
    result.latencyMs.p99 >= 4000
  )
    break;
}

const healthAfter = await fetch(`${baseUrl}/api/health`).then(
  async (response) => ({
    status: response.status,
    body: await response.json(),
  }),
);
output.healthAfter = {
  status: healthAfter.status,
  db: healthAfter.body?.db ?? 'unknown',
};
console.log(`CAPACITY_RESULT=${JSON.stringify(output)}`);
