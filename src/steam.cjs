'use strict';
const crypto = require('node:crypto');
const state = require('./state.cjs');
const parse = require('./parse.cjs');
const ORIGIN = 'https://store.steampowered.com';
class Steam {
  constructor(fetchImpl = fetch) { this.fetch = fetchImpl; this.deadline = Date.now() + 240000; }
  async connect() {
    const {LoginSession} = require('steam-session');
    let auth;
    try { auth = state.read('auth.json'); } catch { throw new Error('STEAM_LOGIN_REQUIRED: run npm run login'); }
    const session = new LoginSession(auth.platform);
    session.refreshToken = auth.refreshToken;
    if (Date.now() - Number(auth.renewalCheckedAt || 0) > 86400000) {
      await session.renewRefreshToken();
      auth = {...auth, refreshToken: session.refreshToken, renewalCheckedAt: Date.now()};
      // Persist a rotated token immediately, before any subsequent request.
      state.save('auth.json', auth);
    }
    const cookies = (await session.getWebCookies()).filter(c => !/;\s*domain=/i.test(c) || /;\s*domain=\.?store\.steampowered\.com(?:;|$)/i.test(c)).map(c => c.split(';')[0]);
    if (!cookies.some(c => c.startsWith('steamLoginSecure='))) throw new Error('STEAM_LOGIN_REQUIRED: missing store cookie');
    this.sessionId = cookies.find(c => c.startsWith('sessionid='))?.slice(10) || crypto.randomBytes(12).toString('hex');
    if (!cookies.some(c => c.startsWith('sessionid='))) cookies.push('sessionid=' + this.sessionId);
    this.headers = {Cookie: cookies.join('; '), 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9'};
  }
  async request(path, options = {}) {
    let url = new URL(path, ORIGIN);
    for (let hop = 0; hop < 5; hop++) {
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) throw new Error('Steam run time budget exceeded');
      if (url.origin !== ORIGIN) throw new Error('Steam redirect outside store refused');
      if (/^\/login(?:\/|$)/i.test(url.pathname)) throw new Error('STEAM_LOGIN_REQUIRED');
      const response = await this.fetch(url, {...options, headers: {...this.headers, ...options.headers}, redirect: 'manual', signal: AbortSignal.timeout(Math.min(25000, remaining))});
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Steam redirect without destination');
        const dest = new URL(location, url);
        if (dest.origin !== ORIGIN || /^\/login(?:\/|$)/i.test(dest.pathname)) throw new Error('Steam login or external redirect');
        if (options.method === 'POST') {
          if (![301, 302, 303].includes(response.status)) throw new Error('Unexpected POST redirect');
          // A redirect is not proof of a successful license grant.
          return {redirectedClaim: true, status: response.status};
        }
        url = dest;
        continue;
      }
      if (!response.ok) throw new Error('Steam HTTP ' + response.status);
      return response;
    }
    throw new Error('Too many Steam redirects');
  }
  async ownership() {
    const data = await (await this.request('/dynamicstore/userdata/?l=english&_=' + Date.now())).json();
    if (!Array.isArray(data.rgOwnedApps)) throw new Error('Steam ownership unavailable');
    return {apps: new Set(data.rgOwnedApps.map(String)), packages: new Set((data.rgOwnedPackages || []).map(String))};
  }
  async discover() {
    const found = new Map(); let start = 0;
    for (let i = 0; i < 20; i++) {
      const query = new URLSearchParams({start: String(start), count: '100', specials: '1', maxprice: 'free', infinite: '1', l: 'english'});
      const result = await (await this.request('/search/results/?' + query)).json();
      if (Number(result.success) !== 1 || typeof result.results_html !== 'string' || !Number.isFinite(Number(result.total_count))) throw new Error('Invalid Steam search response');
      for (const offer of parse.offers(result.results_html)) found.set(offer.appId, offer);
      const count = parse.rows(result.results_html).length;
      start += count;
      if (start >= Number(result.total_count)) return {games: [...found.values()], searchTotal: Number(result.total_count)};
      if (!count) throw new Error('Steam search stopped before all results were read');
    }
    throw new Error('Steam search pagination limit reached; refusing silent partial scan');
  }
  async page(appId) { return parse.page(await (await this.request('/app/' + appId + '/?l=english')).text(), appId); }
  async isFree(appId) {
    const result = await (await this.request('/api/appdetails?appids=' + appId + '&l=english')).json();
    if (result[appId]?.success !== true) throw new Error('Could not verify base game price');
    return result[appId].data.type === 'game' && result[appId].data.is_free === true;
  }
  async claim(appId, pkg) {
    const fields = pkg.form ? {action: 'add_to_cart', subid: pkg.packageId, sessionid: this.sessionId} : {ajax: 'true', sessionid: this.sessionId};
    const response = await this.request('/freelicense/addfreelicense/' + (pkg.form ? '' : pkg.packageId), {
      method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Origin: ORIGIN, Referer: ORIGIN + '/app/' + appId + '/'}, body: new URLSearchParams(fields).toString()
    });
    if (!response.redirectedClaim) {
      const raw = await response.text();
      if ((response.headers.get('content-type') || '').includes('application/json')) {
        const data = JSON.parse(raw);
        if (data.success !== undefined && ![true, 1, '1'].includes(data.success)) throw new Error('Steam rejected the license request');
      }
    }
  }
}
module.exports = {Steam};
