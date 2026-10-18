'use strict';
async function run(steam, {dryRun = true, maxClaims = 20, wait = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  const scan = await steam.discover();
  let ownership = await steam.ownership();
  const results = [], visited = new Map(); let attempts = 0;
  async function process(appId, metadata = {}, asBase = false, ancestors = new Set()) {
    if (ancestors.has(appId)) throw new Error('Circular base game dependency');
    if (visited.has(appId)) return visited.get(appId);
    const game = {...metadata, appId};
    const finish = (status, extra = {}) => { const result = {...game, status, ...extra}; visited.set(appId, result); results.push(result); return result; };
    try {
      if (ownership.apps.has(appId)) return finish('already_owned');
      const page = await steam.page(appId);
      game.name ||= page.name;
      game.expiresAt = page.expiresAt || null;
      // The only exception to a free-to-keep giveaway is an explicitly verified free base game.
      if (!page.giveaway && !(asBase && await steam.isFree(appId))) return finish('needs_review', {reason: 'No permanent free offer verified / لم يتم تأكيد عرض تملك مجاني'});
      if (page.base && !ownership.apps.has(page.base.appId)) {
        const base = await steam.page(page.base.appId);
        if (!base.giveaway && !await steam.isFree(page.base.appId)) return finish('needs_review', {reason: 'اللعبة الأساسية غير مجانية: ' + page.base.name});
        const dependency = await process(page.base.appId, {name: page.base.name, role: 'base_game'}, true, new Set([...ancestors, appId]));
        if (dryRun) return finish(['eligible_dry_run', 'already_owned'].includes(dependency.status) ? 'eligible_dry_run' : 'needs_review', {reason: 'يتطلب إضافة اللعبة الأساسية المجانية أولًا: ' + page.base.name, dependencyStatus: dependency.status});
        if (!ownership.apps.has(page.base.appId)) return finish('needs_review', {reason: 'لم يتأكد امتلاك اللعبة الأساسية: ' + page.base.name, dependencyStatus: dependency.status});
      }
      if (page.packages.length !== 1) return finish('needs_review', {reason: 'Free license package is missing or ambiguous / الترخيص المجاني غير واضح'});
      const pkg = page.packages[0];
      if (ownership.packages.has(pkg.packageId)) return finish('already_owned', {packageId: pkg.packageId});
      if (dryRun) return finish('eligible_dry_run', {packageId: pkg.packageId});
      if (attempts >= maxClaims) return finish('needs_review', {reason: 'Claim limit reached; retry next run / وصلنا لحد المحاولات'});
      attempts++;
      await wait(1000);
      await steam.claim(appId, pkg);
      for (let i = 0; i < 3; i++) {
        await wait(2000);
        ownership = await steam.ownership();
        if (ownership.apps.has(appId) || ownership.packages.has(pkg.packageId)) break;
      }
      return finish(ownership.apps.has(appId) || ownership.packages.has(pkg.packageId) ? 'claimed' : 'verification_pending', {packageId: pkg.packageId});
    } catch (error) {
      // Authentication and ownership failures must reach n8n's error workflow.
      if (/LOGIN_REQUIRED|ownership unavailable|login or external redirect|time budget exceeded/i.test(error.message)) throw error;
      return finish('error', {reason: error.message});
    }
  }
  for (const offer of scan.games) await process(offer.appId, offer);
  return {mode: dryRun ? 'dry_run' : 'claim', candidateCount: scan.games.length, candidateAppIds: scan.games.map(g => g.appId), searchTotal: scan.searchTotal, attempts, results};
}
module.exports = {run};
