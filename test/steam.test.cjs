const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Steam} = require('../src/steam.cjs');
test('cookies are never forwarded to another origin after a redirect', async () => {
  let calls = 0;
  const steam = new Steam(async () => { calls++; return new Response('', {status: 302, headers: {Location: 'https://example.org/collect'}}); });
  steam.headers = {Cookie: 'test=fake'};
  await assert.rejects(steam.request('/app/1/'), /external redirect/);
  assert.equal(calls, 1);
});
test('claim redirect does not resubmit the POST or imply ownership', async () => {
  let calls = 0;
  const steam = new Steam(async () => { calls++; return new Response('', {status: 302, headers: {Location: '/account/licenses/'}}); });
  const result = await steam.request('/freelicense/addfreelicense/', {method: 'POST'});
  assert.equal(result.redirectedClaim, true);
  assert.equal(calls, 1);
});
