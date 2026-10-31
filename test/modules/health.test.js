import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('Phase 1: App Foundation & Health Check', () => {
  const app = createApp();

  test('GET /health returns 200 with status ok and uptime', async () => {
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'].includes('application/json'), true);
    assert.equal(res.body.status, 'ok');
    assert.equal(typeof res.body.uptime, 'number');
    assert.equal(typeof res.body.timestamp, 'string');
    assert.ok(res.headers['x-request-id'], 'Response must include x-request-id header');
  });

  test('GET /health honors incoming x-request-id header', async () => {
    const customRequestId = 'test-trace-id-12345';
    const res = await request(app).get('/health').set('x-request-id', customRequestId);

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-request-id'], customRequestId);
  });

  test('GET /unknown-route returns 404 in standardized error format', async () => {
    const res = await request(app).get('/non-existent-route');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message.includes('not found'));
    assert.ok(res.body.error.requestId, 'Error body must include requestId');
  });

  test('POST /health with malformed JSON body returns 400 MALFORMED_JSON', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{ bad json: ');

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'MALFORMED_JSON');
    assert.ok(res.body.error.requestId);
  });
});
