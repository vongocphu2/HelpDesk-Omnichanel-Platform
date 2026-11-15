// Local acceptance: temporary fixtures only; no provider calls or existing-account changes.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { hash } from 'bcryptjs';
import pg from 'pg';

await ConfigModule.forRoot({ envFilePath: ['.env', '../.env'] });
if (process.env.NODE_ENV === 'production') throw new Error('LOCAL_TEST_ONLY');
const base = (process.env.HELPDESK_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const db = new pg.Client({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'postgres', password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE || 'helpdesk_db' });
const ids = [];
const ticketId = randomUUID();
const password = randomBytes(24).toString('hex');
const accounts = {};
const tokens = {};
let checks = 0;
async function request(path, expected, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, expected, `${method} ${path}`);
  checks++;
  return response.json();
}
await db.connect();
try {
  await request('/auth/me', 401, 'invalid-token-for-test');
  const encoded = await hash(password, 12);
  for (const role of ['admin', 'manager', 'agent', 'customer']) {
    const roleRow = await db.query('SELECT role_id FROM roles WHERE role_name=$1', [role]);
    assert.equal(roleRow.rowCount, 1);
    const id = randomUUID();
    const email = `qa43.${id}@example.com`;
    await db.query('INSERT INTO users (user_id,full_name,email,password_hash,role_id,status) VALUES ($1,$2,$3,$4,$5,$6)', [id, 'Task 4 acceptance', email, encoded, roleRow.rows[0].role_id, 'active']);
    ids.push(id);
    accounts[role] = { id, email };
  }
  for (const role of ['admin', 'manager', 'agent']) {
    const login = await request('/auth/login', 200, null, { email: accounts[role].email, password });
    assert.equal(login.data.user.role, role);
    assert.ok(!JSON.stringify(login).includes('password_hash'));
    tokens[role] = login.data.access_token;
    const me = await request('/auth/me', 200, tokens[role]);
    assert.equal(me.data.user_id, accounts[role].id);
    await request('/tickets?limit=1', 200, tokens[role]);
  }
  await request('/auth/login', 401, null, { email: accounts.admin.email, password: 'incorrect-password' });
  await request('/auth/login', 401, null, { email: accounts.customer.email, password });
  await request('/tickets', 401);
  await request('/ai/triage/status', 200, tokens.admin);
  for (const role of ['manager', 'agent']) {
    await request('/ai/triage/status', 403, tokens[role]);
    await request('/email/test-connection', 403, tokens[role]);
    await request('/email/sync', 403, tokens[role], {}, 'POST');
  }
  const channel = await db.query('SELECT channel_id FROM channels LIMIT 1');
  assert.equal(channel.rowCount, 1);
  await db.query("INSERT INTO tickets (ticket_id,ticket_code,customer_id,channel_id,subject,status,priority,is_urgent_bumped,ai_status) VALUES ($1,$2,$3,$4,$5,'new','medium',false,'skipped')", [ticketId, `QA43-${randomBytes(5).toString('hex')}`, accounts.customer.id, channel.rows[0].channel_id, 'Task 4 acceptance - synthetic']);
  let historyCount = 0;
  for (const [role, status] of [['agent', 'open'], ['manager', 'pending'], ['admin', 'closed']]) {
    const updated = await request(`/tickets/${ticketId}`, 200, tokens[role], { status, changed_by: accounts.customer.id }, 'PATCH');
    assert.equal(updated.data.status, status);
    assert.equal(updated.data.status_history.length, ++historyCount);
    const entry = updated.data.status_history.find(h => h.new_status === status);
    assert.equal(entry.changed_by, accounts[role].id);
    if (status === 'closed') assert.ok(updated.data.closed_at);
  }
  const same = await request(`/tickets/${ticketId}`, 200, tokens.admin, { status: 'closed' }, 'PATCH');
  assert.equal(same.data.status_history.length, historyCount);
  const reopened = await request(`/tickets/${ticketId}`, 200, tokens.agent, { status: 'open', priority: 'low' }, 'PATCH');
  assert.equal(reopened.data.closed_at, null);
  assert.equal(reopened.data.priority, 'low');
  for (const body of [{}, { status: null }, { priority: 'critical' }, { assigned_agent_id: accounts.agent.id }]) {
    await request(`/tickets/${ticketId}`, 400, tokens.agent, body, 'PATCH');
  }
  await request('/tickets/QA43-NOT-FOUND', 404, tokens.agent, { status: 'open' }, 'PATCH');
  await db.query("UPDATE users SET status='inactive' WHERE user_id=$1", [accounts.agent.id]);
  await request('/auth/me', 401, tokens.agent);
  let limited = false;
  for (let i = 0; i < 11; i++) {
    const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accounts.admin.email, password: 'incorrect-password' }), signal: AbortSignal.timeout(15000) });
    if (response.status === 429) { limited = true; break; }
    assert.equal(response.status, 401);
  }
  assert.ok(limited, 'login must be rate limited');
  console.log(`PASS: ${checks} HTTP checks; JWT/RBAC, ticket history, invalid input, locked account, rate limit`);
} finally {
  // Delete only UUIDs allocated by this invocation, preserving all pre-existing records.
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM ticket_status_history WHERE ticket_id=$1', [ticketId]);
    await db.query('DELETE FROM tickets WHERE ticket_id=$1', [ticketId]);
    await db.query('DELETE FROM users WHERE user_id=ANY($1::uuid[])', [ids]);
    await db.query('COMMIT');
    console.log('PASS: temporary fixtures removed');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}
