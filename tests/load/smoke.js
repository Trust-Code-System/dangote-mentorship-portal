import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const targetVus = Number(__ENV.VUS || 100);

export const options = {
  scenarios: {
    public_readiness: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: Math.max(1, Math.ceil(targetVus / 4)) },
        { duration: '1m', target: targetVus },
        { duration: '2m', target: targetVus },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    checks: ['rate>0.99'],
  },
};

export default function readinessScenario() {
  const health = http.get(`${baseUrl}/api/health`, {
    tags: { endpoint: 'health' },
  });
  check(health, {
    'health responds successfully': (response) => response.status === 200,
    'health reports database up': (response) => response.json('db') === 'up',
  });

  const login = http.get(`${baseUrl}/login`, {
    tags: { endpoint: 'login' },
  });
  check(login, {
    'login page is available': (response) => response.status === 200,
    'security headers are present': (response) =>
      Boolean(response.headers['Content-Security-Policy']) &&
      response.headers['X-Content-Type-Options'] === 'nosniff',
  });

  sleep(1);
}
