import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const server = await createServer({ server: { middlewareMode: true } });
const storage = new Map();
const redirects = [];
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = { location: { pathname: '/', assign: (url) => redirects.push(url) } };

try {
  const { default: api } = await server.ssrLoadModule('/src/services/api.js');
  let sent;
  api.defaults.adapter = async (config) => {
    sent = config;
    return { data: { statusCode: 200, data: { access_token: 'test-token' } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  storage.set('token', 'test-token');
  const login = await api.post('/auth/login', {});
  assert.equal(login.data.access_token, 'test-token');
  assert.equal(sent.headers.get('Authorization'), undefined);
  await api.get('/auth/me');
  assert.equal(sent.headers.get('Authorization'), 'Bearer test-token');
  console.log('PASS: response shape and Bearer header');

  const reject = (status, replaceToken) => {
    api.defaults.adapter = async (config) => {
      if (replaceToken) storage.set('token', replaceToken);
      throw { config, response: { status } };
    };
  };
  reject(401);
  await assert.rejects(api.get('/auth/me'));
  assert.equal(storage.has('token'), false);
  assert.deepEqual(redirects, ['/login']);
  console.log('PASS: step 49 invalid token clears session and redirects');

  storage.set('token', 'valid-token');
  redirects.length = 0;
  reject(403);
  await assert.rejects(api.get('/ai/triage/status'));
  assert.equal(storage.get('token'), 'valid-token');
  assert.equal(redirects.length, 0);
  console.log('PASS: forbidden request preserves session');

  reject(401, 'new-token');
  await assert.rejects(api.get('/auth/me'));
  assert.equal(storage.get('token'), 'new-token');
  assert.equal(redirects.length, 0);
  reject(401);
  await assert.rejects(api.post('/auth/login', {}));
  assert.equal(storage.get('token'), 'new-token');
  console.log('PASS: stale request and failed login do not erase newer session');

  window.location.pathname = '/portal';
  await assert.rejects(api.get('/auth/me'));
  assert.equal(storage.has('token'), false);
  assert.equal(redirects.length, 0);
  console.log('PASS: public portal is not redirected');

  const { default: App } = await server.ssrLoadModule('/src/App.jsx');
  const html = renderToString(React.createElement(MemoryRouter, { initialEntries: ['/login'] }, React.createElement(App)));
  assert.ok(html.includes('auth-form') && html.includes('type="password"'));
  console.log('PASS: login form renders without undefined state');
} finally {
  await server.close();
}
