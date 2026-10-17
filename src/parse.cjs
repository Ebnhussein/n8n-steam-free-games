'use strict';
function decode(s) {
  return String(s ?? '').replace(/&#x([0-9a-f]+);/gi, (_, n) => point(n, 16))
    .replace(/&#(\d+);/g, (_, n) => point(n, 10))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}
function point(n, radix) { const x = parseInt(n, radix); return x <= 0x10ffff ? String.fromCodePoint(x) : ''; }
function clean(s) { return decode(String(s ?? '').replace(/<[^>]*>/g, '')); }
function attr(tag, name) {
  return decode(tag.match(new RegExp('\\b' + name + '\\s*=\\s*(["\x27])([\\s\\S]*?)\\1', 'i'))?.[2]);
}
function rows(html) { return [...html.matchAll(/<a\b[^>]*data-ds-appid=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)].map(m => m[0]); }
function offers(html) {
  const found = new Map();
  for (const row of rows(html)) {
    if (!/-\s*100\s*%/.test(row) || !/data-price-final=["']0["']/.test(row)) continue;
    const appId = row.match(/data-ds-appid=["'](\d+)["']/)?.[1];
    if (!appId) continue;
    found.set(appId, {
      appId,
      name: clean(row.match(/<span\b[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]) || appId,
      originalPrice: clean(row.match(/<div\b[^>]*class=["'][^"']*\bdiscount_original_price\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) || null,
      photo: decode(row.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1]) || null
    });
  }
  return [...found.values()];
}
function page(html, appId) {
  const base = html.match(/requires\s+the\s+base\s+game\s*<a\b[^>]*href=["']https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const candidates = new Map();
  for (const match of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)) {
    const form = match[0], tag = form.match(/^<form\b[^>]*>/i)[0];
    if (attr(tag, 'method').toUpperCase() !== 'POST') continue;
    let action;
    try { action = new URL(attr(tag, 'action'), 'https://store.steampowered.com'); } catch { continue; }
    if (action.origin !== 'https://store.steampowered.com' || action.pathname.replace(/\/+$/, '') !== '/freelicense/addfreelicense') continue;
    const ids = [...form.matchAll(/<input\b[^>]*>/gi)].map(m => m[0]).filter(t => attr(t, 'name') === 'subid').map(t => attr(t, 'value'));
    if (ids.length === 1 && /^\d{1,10}$/.test(ids[0])) candidates.set(ids[0], {packageId: ids[0], form: true});
  }
  for (const m of html.matchAll(/\bAddFreeLicense\s*\(\s*(\d+)/g)) {
    if (!candidates.has(m[1])) candidates.set(m[1], {packageId: m[1], form: false});
  }
  return {
    appId,
    name: clean(html.match(/<div[^>]*id=["']appHubAppName["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) || appId,
    giveaway: /\bfree\s+to\s+keep\b/i.test(html),
    base: base ? {appId: base[1], name: clean(base[2])} : null,
    packages: [...candidates.values()]
  };
}
module.exports = {clean, decode, attr, rows, offers, page};
