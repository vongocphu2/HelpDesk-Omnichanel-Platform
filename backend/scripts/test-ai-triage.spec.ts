import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const runId = 'AI33-20261106084344380';
let directory: string | undefined;
let server: Server | undefined;

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((done) => server!.close(() => done()));
    server = undefined;
  }
  if (directory) {
    const relativePath = relative(resolve(tmpdir()), resolve(directory));
    if (
      !relativePath.startsWith('helpdesk-ai-smoke-') ||
      relativePath.includes('..')
    )
      throw new Error('Unexpected temporary test directory');
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

async function setup(
  options: {
    incomplete?: boolean;
    wrongTicket?: boolean;
    blocked?: boolean;
    oldModel?: boolean;
  } = {},
) {
  directory = await mkdtemp(join(tmpdir(), 'helpdesk-ai-smoke-'));
  await mkdir(join(directory, 'scripts'));
  await mkdir(join(directory, 'test/fixtures'), { recursive: true });
  const script = await readFile(resolve('scripts/test-ai-triage.mjs'), 'utf8');
  const fixtures = await readFile(
    resolve('test/fixtures/triage-cases.json'),
    'utf8',
  );
  await writeFile(join(directory, 'scripts/test-ai-triage.mjs'), script);
  await writeFile(join(directory, 'test/fixtures/triage-cases.json'), fixtures);
  const cases = JSON.parse(fixtures) as {
    id: string;
    subject: string;
    sentiment: string;
    urgent: boolean;
    priority: string;
  }[];
  const tickets = cases.map((c, i) => ({
    ticket_code: `TK-${1000 + i}`,
    subject: `${options.wrongTicket ? 'OTHER-RUN' : runId} ${c.id}: ${c.subject}`,
    ai_status: 'completed',
    ai_attempts: 1,
    ai_error: null,
    ai_analyzed_at: '2026-11-06T09:00:00Z',
    ai_model: options.oldModel ? 'old-provider-model' : 'gpt-4.1-mini',
    sentiment_label: c.sentiment,
    sentiment_score: '0.950',
    urgency_score: c.urgent ? '0.950' : '0.100',
    priority: c.urgent ? 'urgent' : c.priority,
    is_urgent_bumped: c.urgent,
  }));
  const source = JSON.stringify({
    runId,
    results: cases.slice(0, options.incomplete ? 7 : 8).map((c, i) => ({
      id: c.id,
      ticket_code: tickets[i].ticket_code,
      expected: { sentiment: 'tampered' },
      actual: { ai_status: 'failed' },
      passed: false,
    })),
  });
  const input = join(directory, 'source.json');
  await writeFile(input, source);
  const methods: string[] = [];
  server = createServer((request, response) => {
    methods.push(request.method || '');
    const url = new URL(request.url || '/', 'http://localhost');
    let body: unknown;
    if (url.pathname.endsWith('/health'))
      body = { database: { status: 'connected' } };
    else if (url.pathname.endsWith('/ai/triage/status'))
      body = {
        ready: true,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        provider_blocked_code: options.blocked ? 'AI_INSUFFICIENT_QUOTA' : null,
      };
    else if (/\/tickets\/TK-\d{4}$/.test(url.pathname))
      body = {
        data: tickets.find((t) => url.pathname.endsWith(t.ticket_code)),
      };
    else {
      let data = [...tickets].sort(
        (a, b) => Number(b.is_urgent_bumped) - Number(a.is_urgent_bumped),
      );
      if (url.searchParams.has('is_urgent_bumped'))
        data = data.filter((t) => t.is_urgent_bumped);
      if (url.searchParams.has('sentiment_label'))
        data = data.filter(
          (t) => t.sentiment_label === url.searchParams.get('sentiment_label'),
        );
      body = { data, total: data.length };
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No test server');
  const run = () =>
    exec(
      process.execPath,
      [join(directory!, 'scripts/test-ai-triage.mjs'), '--resume', input],
      {
        cwd: directory,
        env: {
          ...process.env,
          HELPDESK_API_URL: `http://127.0.0.1:${address.port}/api/v1`,
        },
        timeout: 10000,
      },
    );
  return { run, methods, input, source };
}

describe('Smoke report recheck', () => {
  it('stops immediately on provider billing block without creating data', async () => {
    const test = await setup({ blocked: true });
    await expect(test.run()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('AI_INSUFFICIENT_QUOTA'),
    });
    expect(test.methods).toEqual(['GET', 'GET']);
  });

  it('does not count old provider results as proof of the new model', async () => {
    const test = await setup({ oldModel: true });
    await expect(test.run()).rejects.toMatchObject({ code: 1 });
    const output = join(directory!, 'artifacts/ai-triage');
    const files = await readdir(output);
    const report = JSON.parse(await readFile(join(output, files[0]), 'utf8'));
    expect(report.checks.ModelRecorded).toBe(false);
  });
  it('refreshes failed results with GET only, preserves evidence and uses repository expectations', async () => {
    const test = await setup();
    await test.run();
    expect(test.methods.length).toBeGreaterThan(8);
    expect(test.methods.every((m) => m === 'GET')).toBe(true);
    expect(await readFile(test.input, 'utf8')).toBe(test.source);
    const output = join(directory!, 'artifacts/ai-triage');
    const files = await readdir(output);
    const report = JSON.parse(await readFile(join(output, files[0]), 'utf8'));
    expect(report.runId).toBe(runId);
    expect(report.recheck).toBe(true);
    expect(Object.values(report.checks).every(Boolean)).toBe(true);
    expect(report.results).toHaveLength(8);
  });

  it('rejects an incomplete report before calling the API', async () => {
    const test = await setup({ incomplete: true });
    await expect(test.run()).rejects.toMatchObject({ code: 1 });
    expect(test.methods).toHaveLength(0);
  });

  it('rejects ticket codes that belong to another run without creating tickets', async () => {
    const test = await setup({ wrongTicket: true });
    await expect(test.run()).rejects.toMatchObject({ code: 1 });
    expect(test.methods.every((m) => m === 'GET')).toBe(true);
  });
});
