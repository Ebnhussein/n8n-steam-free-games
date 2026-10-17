const {test} = require('node:test');
const assert = require('node:assert/strict');
const {run} = require('../src/bot.cjs');
function fake({baseFree = false, baseOwned = false, confirmed = true, giveaway = true} = {}) {
  const owned = {apps: new Set(baseOwned ? ['10'] : []), packages: new Set()};
  const calls = [];
  return {
    calls,
    discover: async () => ({games: [{appId: '20', name: 'DLC'}], searchTotal: 1}),
    ownership: async () => owned,
    page: async id => ({appId: id, name: id === '10' ? 'Base' : 'DLC', giveaway: id === '20' && giveaway, base: id === '20' ? {appId: '10', name: 'Base'} : null, packages: [{packageId: id + '0', form: true}]}),
    isFree: async () => baseFree,
    claim: async (id, pkg) => { calls.push(id); if (confirmed) {owned.apps.add(id); owned.packages.add(pkg.packageId);} }
  };
}
const wait = async () => {};
test('dry run never claims a license', async () => {
  const steam = fake({baseFree: true});
  const result = await run(steam, {dryRun: true, wait});
  assert.equal(steam.calls.length, 0);
  assert.ok(result.results.every(r => r.status === 'eligible_dry_run'));
});
test('claims a free base first, then its DLC after ownership confirmation', async () => {
  const steam = fake({baseFree: true});
  const result = await run(steam, {dryRun: false, wait});
  assert.deepEqual(steam.calls, ['10', '20']);
  assert.ok(result.results.every(r => r.status === 'claimed'));
});
test('paid base blocks the claim', async () => {
  const steam = fake();
  const result = await run(steam, {dryRun: false, wait});
  assert.equal(steam.calls.length, 0);
  assert.equal(result.results[0].status, 'needs_review');
});
test('unconfirmed base grant prevents claiming its DLC', async () => {
  const steam = fake({baseFree: true, confirmed: false});
  const result = await run(steam, {dryRun: false, wait});
  assert.deepEqual(steam.calls, ['10']);
  assert.equal(result.results[0].status, 'verification_pending');
  assert.equal(result.results[1].status, 'needs_review');
});
test('temporary free weekend does not count as a permanent offer', async () => {
  const steam = fake({baseOwned: true, giveaway: false});
  const result = await run(steam, {dryRun: false, wait});
  assert.equal(steam.calls.length, 0);
  assert.equal(result.results[0].status, 'needs_review');
});
test('package ownership can verify a DLC when app ownership is absent', async () => {
  const steam = fake({baseOwned: true});
  steam.claim = async (_id, pkg) => { const own = await steam.ownership(); own.packages.add(pkg.packageId); };
  const result = await run(steam, {dryRun: false, wait});
  assert.equal(result.results[0].status, 'claimed');
});
test('ambiguous package never triggers a claim', async () => {
  const steam = fake({baseOwned: true});
  const original = steam.page;
  steam.page = async id => ({...await original(id), packages: []});
  const result = await run(steam, {dryRun: false, wait});
  assert.equal(steam.calls.length, 0);
  assert.equal(result.results[0].status, 'needs_review');
});
test('dry run does not call a blocked dependency eligible', async () => {
  const steam = fake({baseFree: true});
  const original = steam.page;
  steam.page = async id => ({...await original(id), ...(id === '10' ? {packages: []} : {})});
  const result = await run(steam, {dryRun: true, wait});
  assert.equal(result.results.at(-1).status, 'needs_review');
});
test('authentication loss propagates to the n8n error workflow', async () => {
  const steam = fake({baseOwned: true});
  steam.page = async () => { throw new Error('STEAM_LOGIN_REQUIRED'); };
  await assert.rejects(run(steam, {dryRun: false, wait}), /LOGIN_REQUIRED/);
});
test('claim budget is enforced even with a free-base dependency', async () => {
  const steam = fake({baseFree: true});
  const result = await run(steam, {dryRun: false, maxClaims: 1, wait});
  assert.deepEqual(steam.calls, ['10']);
  assert.equal(result.results.at(-1).status, 'needs_review');
});
