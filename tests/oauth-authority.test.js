/**
 * Individual vs agent OAuth journeys stay separate.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAuthorityType,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getActiveConnection,
} from '../src/lib/hmrc-oauth.js';
import { createUser, newId } from '../src/lib/auth.js';
import { getDb } from '../src/lib/db.js';

process.env.HMRC_OAUTH_MOCK = '1';
delete process.env.HMRC_CLIENT_ID;
delete process.env.HMRC_CLIENT_SECRET;

describe('OAuth authority separation', () => {
  it('normalizes authority types', () => {
    assert.equal(normalizeAuthorityType('individual'), 'individual');
    assert.equal(normalizeAuthorityType('agent'), 'agent');
    assert.equal(normalizeAuthorityType('AGENT_SERVICES'), 'agent');
    assert.equal(normalizeAuthorityType(''), 'individual');
  });

  it('stores separate individual and agent connections', async () => {
    const email = `oauth-auth-${Date.now()}@example.com`;
    const user = createUser({
      email,
      password: 'TestPass123!',
      name: 'OAuth Auth',
    });
    const ind = buildAuthorizeUrl({
      userId: user.id,
      authorityType: 'individual',
    });
    assert.equal(ind.authorityType, 'individual');
    await exchangeCodeForTokens({ code: 'mock-auth-code', state: ind.state });

    const ag = buildAuthorizeUrl({ userId: user.id, authorityType: 'agent' });
    assert.equal(ag.authorityType, 'agent');
    await exchangeCodeForTokens({ code: 'mock-auth-code', state: ag.state });

    const asInd = getActiveConnection(user.id, { authorityType: 'individual' });
    const asAgent = getActiveConnection(user.id, { authorityType: 'agent' });
    assert.ok(asInd && !asInd.expired);
    assert.ok(asAgent && !asAgent.expired);
    assert.equal(asInd.authorityType, 'individual');
    assert.equal(asAgent.authorityType, 'agent');
    assert.notEqual(asInd.id, asAgent.id);

    const rows = getDb()
      .prepare(
        `SELECT authority_type FROM hmrc_connections WHERE user_id = ? AND revoked_at IS NULL`
      )
      .all(user.id);
    const types = rows.map((r) => r.authority_type).sort();
    assert.deepEqual(types, ['agent', 'individual']);
  });
});
