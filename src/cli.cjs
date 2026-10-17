'use strict';
const readline = require('node:readline/promises');
const {Writable} = require('node:stream');
const state = require('./state.cjs');
async function login() {
  if (!process.stdin.isTTY) throw new Error('Run login in an interactive terminal with a TTY');
  const {LoginSession, EAuthTokenPlatformType, EAuthSessionGuardType} = require('steam-session');
  let hidden = false;
  const output = new Writable({write(chunk, _encoding, done) { if (!hidden) process.stdout.write(chunk); done(); }});
  const rl = readline.createInterface({input: process.stdin, output, terminal: true});
  async function question(prompt, secret = false, trim = true) {
    process.stdout.write(prompt);
    hidden = secret;
    try { const value = await rl.question(''); return trim ? value.trim() : value; }
    finally { hidden = false; if (secret) process.stdout.write('\n'); }
  }
  const session = new LoginSession(EAuthTokenPlatformType.MobileApp);
  session.loginTimeout = 120000;
  let rejectLogin;
  const completed = new Promise((resolve, reject) => {
    rejectLogin = reject;
    session.once('authenticated', resolve);
    session.once('error', reject);
    session.once('timeout', () => reject(new Error('Steam login timed out')));
  });
  // Attach immediately so a network error during an interactive prompt is handled.
  completed.catch(() => {});
  const deadline = setTimeout(() => rejectLogin(new Error('Login time limit reached; try again')), 240000);
  try {
    const accountName = await question('Steam account name: ');
    const password = await question('Password (hidden): ', true, false);
    const code = await question('Current MOBILE Steam Guard code, or Enter for email/app approval (hidden): ', true);
    const actions = await session.startWithCredentials({accountName, password, ...(code ? {steamGuardCode: code} : {})});
    if (actions.actionRequired) {
      const guards = actions.validActions || [];
      if (guards.some(x => [EAuthSessionGuardType.EmailCode, EAuthSessionGuardType.DeviceCode].includes(x.type))) {
        const next = await question('Steam Guard code just received/current code (hidden): ', true);
        if (next) await session.submitSteamGuardCode(next);
        else console.log('Approve this sign-in in your Steam app/email.');
      } else {
        console.log('Approve this sign-in in your Steam app/email.');
      }
    }
    await completed;
    state.save('auth.json', {platform: EAuthTokenPlatformType.MobileApp, refreshToken: session.refreshToken, renewalCheckedAt: Date.now()});
    console.log('Login saved locally. Your password was not saved.');
  } finally {
    clearTimeout(deadline);
    session.cancelLoginAttempt();
    rl.close();
  }
}
(async () => {
  switch (process.argv[2]) {
    case 'init':
      console.log('Put this in the n8n Header Auth credential (X-API-Key):');
      console.log(state.apiKey());
      break;
    case 'login': await login(); break;
    case 'check': {
      const {Steam} = require('./steam.cjs');
      const steam = new Steam();
      await steam.connect();
      await steam.ownership();
      console.log(JSON.stringify({authenticated: true}));
      break;
    }
    default: throw new Error('Usage: node src/cli.cjs init|login|check');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
