// For the original SSH workflow: node 05 - Filter Offers.
const TEST_MODE = false;
if (TEST_MODE) return [{json: {testMode: true, candidateCount: 1, searchTotal: 1, games: [{appId: '570', name: 'Dota 2', originalPrice: null, photo: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/header.jpg'}]}}];
const response = $input.first().json;
if (Number(response.success) !== 1 || typeof response.results_html !== 'string') throw new Error('نتائج بحث Steam غير سليمة');
function clean(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}
const games = [], seen = new Set();
for (const match of response.results_html.matchAll(/<a\b[^>]*data-ds-appid="[^"]+"[^>]*>[\s\S]*?<\/a>/gi)) {
  const row = match[0];
  if (!/-\s*100\s*%/.test(row) || !/data-price-final="0"/.test(row)) continue;
  const appId = row.match(/data-ds-appid="(\d+)"/)?.[1];
  if (!appId || seen.has(appId)) continue;
  seen.add(appId);
  games.push({appId,
    name: clean(row.match(/<span\b[^>]*class="title"[^>]*>([\s\S]*?)<\/span>/i)?.[1]) || appId,
    originalPrice: clean(row.match(/<div\b[^>]*class="[^"]*\bdiscount_original_price\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]) || null,
    photo: clean(row.match(/<img\b[^>]*src="([^"]+)"/i)?.[1]) || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`
  });
}
// This node also runs when there are zero candidates, before the IF false branch.
// Record disappearance here so a later genuine offer can notify again.
const state = $getWorkflowStaticData('global');
const db = state.steamNotificationsV2 ||= {offers: {}};
const active = new Set(games.map(g => g.appId));
for (const [id, entry] of Object.entries(db.offers)) {
  if (!active.has(id)) {
    entry.misses = (entry.misses || 0) + 1;
    if (entry.misses >= 2) entry.active = false;
  }
}
for (const id of active) {
  const old = db.offers[id];
  if (!old || old.active === false) db.offers[id] = {cycle: (old?.cycle || 0) + 1, active: true, misses: 0, expiresAt: null, lastStatus: null, lastNotifiedEnd: null};
  else old.misses = 0;
}
return [{json: {testMode: false, candidateCount: games.length, searchTotal: response.total_count, games}}];
