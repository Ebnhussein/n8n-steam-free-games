// Original SSH workflow: replace node 08 - Build Telegram Message.
const execution = $input.first().json;
if (Number(execution.code) !== 0) throw new Error(execution.stderr || 'فشل سكربت Steam');
const parsed = JSON.parse(execution.stdout);
const offers = $('05 - Filter Offers').first().json.games || [];
const byId = new Map(offers.map(g => [String(g.appId), g]));
const data = {...parsed, presenceRecorded: true, candidateAppIds: offers.map(g => g.appId), results: parsed.results.map(g => ({...byId.get(String(g.appId)), ...g}))};
// n8n Code node: Run Once for All Items. No external modules required.
if (!Array.isArray(data.results)) throw new Error('Invalid Steam helper response');
const isTest = data.mode === 'dry_run';
const saved = $getWorkflowStaticData('global');
const db = isTest
  ? JSON.parse(JSON.stringify(saved.steamNotificationsV2 || {offers: {}}))
  : (saved.steamNotificationsV2 ||= {offers: {}});
const current = new Set((data.candidateAppIds || data.results.map(g => g.appId)).map(String));
// Free base games can also have a result notification.
for (const g of data.results) current.add(String(g.appId));
if (!data.presenceRecorded) {
  for (const [id, entry] of Object.entries(db.offers)) {
    if (!current.has(id)) {
      entry.misses = (entry.misses || 0) + 1;
      if (entry.misses >= 2) entry.active = false;
    }
  }
}
for (const id of current) {
  const previous = db.offers[id];
  if (!previous || previous.active === false) {
    db.offers[id] = {cycle: (previous?.cycle || 0) + 1, active: true, misses: 0, expiresAt: null, lastStatus: null, lastNotifiedEnd: null};
  } else { previous.misses = 0; }
}
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const labels = {
  claimed: '✅ اتضافت لمكتبتك / Added to your library',
  needs_review: '⚠️ محتاجة مراجعة / Needs review',
  verification_pending: '⏳ الإضافة غير مؤكدة / Ownership unconfirmed',
  eligible_dry_run: '🧪 اختبار بدون إضافة / Dry run',
  error: '❌ فشلت المحاولة / Attempt failed'
};
const now = Date.now();
function deadline(value) {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return {iso: null, text: '⏰ موعد الانتهاء غير معلن / End time unavailable'};
  const when = new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo', weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  }).format(new Date(time));
  const left = Math.ceil((time - now) / 60000);
  let remaining;
  if (left <= 0) remaining = 'انتهى حسب الموعد المعلن';
  else {
    const days = Math.floor(left / 1440), hours = Math.floor(left % 1440 / 60), minutes = left % 60;
    remaining = [days ? days + ' يوم' : '', hours ? hours + ' ساعة' : '', minutes ? minutes + ' دقيقة' : ''].filter(Boolean).join(' و');
  }
  return {iso: new Date(time).toISOString(), text: '⏰ ينتهي / Ends: ' + when + '\n🕒 بتوقيت القاهرة / Cairo\n⏳ المتبقي / Left: ' + remaining};
}
const out = [];
for (const g of data.results) {
  if (!/^\d{1,10}$/.test(String(g.appId))) throw new Error('Invalid app ID');
  const entry = db.offers[String(g.appId)];
  const end = deadline(g.expiresAt || entry.expiresAt);
  if (end.iso) entry.expiresAt = end.iso;
  if (g.status === 'already_owned') continue;
  // Countdown, price, image URL and varying error text are not notification identities.
  if (!isTest && entry.lastStatus === g.status && entry.lastNotifiedEnd === end.iso) continue;
  const text = [
    isTest ? '🧪 TEST — no games added' : '',
    '<b>🎮 ' + escape(String(g.name || g.appId).slice(0, 120)) + '</b>',
    '💰 قبل العرض / Before: ' + escape(String(g.originalPrice || 'غير متاح / Unavailable').slice(0, 60)),
    labels[g.status] || escape(g.status),
    g.reason ? escape(String(g.reason).slice(0, 180)) : '',
    end.text,
    'https://store.steampowered.com/app/' + g.appId + '/'
  ].filter(Boolean).join('\n');
  out.push({json: {text, photo: /^https:\/\//i.test(g.photo || '') ? g.photo : null, expiresAt: end.iso}});
  if (!isTest) { entry.lastStatus = g.status; entry.lastNotifiedEnd = end.iso; }
}
// n8n saves this state after a successful published/triggered execution.
// Manual editor executions do not persist static data.
return out;
