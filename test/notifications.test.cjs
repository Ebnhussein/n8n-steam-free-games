const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../workflows/code/build-notifications.js'), 'utf8');
const now = Date.UTC(2026, 9, 18, 18, 0);
function notify(data, store = {}, clock = now) {
  class Clock extends Date { static now() {return clock;} }
  return vm.runInNewContext('(function(){' + code + '\n})()', {
    $input: {first: () => ({json: data})}, $getWorkflowStaticData: () => store,
    Date: Clock, Intl
  });
}
const game = (extra = {}) => ({appId: '20', name: 'Example', status: 'needs_review', reason: 'Base required', expiresAt: '2026-10-19T17:00:00.000Z', ...extra});
const batch = (games, extra = {}) => ({mode: 'claim', candidateAppIds: games.map(g => g.appId), results: games, ...extra});
test('same offer and status sends only once, with no seven-day re-send', () => {
  const store = {};
  const offer = game({expiresAt: '2026-11-30T17:00:00.000Z'});
  assert.equal(notify(batch([offer]), store).length, 1);
  assert.equal(notify(batch([{...offer, reason: 'Different transient reason', originalPrice: '99 USD'}]), store, now + 8 * 86400000).length, 0);
});
test('important status change sends an update once', () => {
  const store = {};
  notify(batch([game()]), store);
  assert.equal(notify(batch([game({status: 'claimed'})]), store).length, 1);
  assert.equal(notify(batch([game({status: 'claimed'})]), store).length, 0);
});
test('changed known deadline notifies once and countdown itself is not identity', () => {
  const store = {};
  notify(batch([game()]), store);
  assert.equal(notify(batch([game({expiresAt: '2026-10-25T17:00:00.000Z'})]), store).length, 1);
  assert.equal(notify(batch([game({expiresAt: '2026-10-25T17:00:00.000Z'})]), store).length, 0);
});
test('unknown deadline is displayed explicitly and not invented', () => {
  const out = notify(batch([game({expiresAt: null})]));
  assert.match(out[0].json.text, /موعد الانتهاء غير معلن/);
});
test('known deadline is formatted for Cairo with remaining duration', () => {
  const out = notify(batch([game()]));
  assert.match(out[0].json.text, /بتوقيت القاهرة/);
  assert.match(out[0].json.text, /٠٨:٠٠/); // 17:00 UTC -> 20:00 Cairo, October 19 2026.
  assert.match(out[0].json.text, /23 ساعة/);
});
test('an old offer can notify again after two complete absent scans', () => {
  const store = {};
  notify(batch([game({expiresAt: null})]), store);
  notify(batch([]), store);
  notify(batch([]), store);
  assert.equal(notify(batch([game({expiresAt: null})]), store).length, 1);
  assert.equal(store.steamNotificationsV2.offers['20'].cycle, 2);
});
test('one missing scan does not create another notification', () => {
  const store = {};
  notify(batch([game()]), store);
  notify(batch([]), store);
  assert.equal(notify(batch([game()]), store).length, 0);
});
test('dry runs do not change persistent notification state', () => {
  const store = {};
  notify(batch([game()], {mode: 'dry_run'}), store);
  assert.deepEqual(store, {});
});
test('missing expiry on a later response keeps the previous known value', () => {
  const store = {};
  notify(batch([game()]), store);
  assert.equal(notify(batch([game({expiresAt: null})]), store).length, 0);
});
test('legacy adapter does not count an absent scan twice', () => {
  const store = {};
  notify(batch([game()]), store);
  store.steamNotificationsV2.offers['20'].misses = 1;
  notify(batch([], {presenceRecorded: true}), store);
  assert.equal(store.steamNotificationsV2.offers['20'].misses, 1);
});
test('legacy 05 and 08 share the same durable workflow ledger', () => {
  const store = {};
  const filter = fs.readFileSync(path.join(__dirname, '../workflows/code/legacy-filter-offers.js'), 'utf8');
  const build = fs.readFileSync(path.join(__dirname, '../workflows/code/legacy-build-message.js'), 'utf8');
  const html = '<a data-ds-appid="20"><span class="title">Example</span><div data-price-final="0">-100%</div></a>';
  const scan = () => vm.runInNewContext('(function(){' + filter + '\n})()', {
    $input: {first: () => ({json: {success: 1, total_count: 1, results_html: html}})},
    $getWorkflowStaticData: () => store
  })[0].json;
  const message = offers => vm.runInNewContext('(function(){' + build + '\n})()', {
    $input: {first: () => ({json: {code: 0, stdout: JSON.stringify(batch([game()]))}})},
    $: () => ({first: () => ({json: offers})}),
    $getWorkflowStaticData: () => store
  });
  assert.equal(message(scan()).length, 1);
  assert.equal(message(scan()).length, 0);
});
