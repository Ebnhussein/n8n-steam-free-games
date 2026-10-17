'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const state = require('./state.cjs');
const {Steam} = require('./steam.cjs');
const {run} = require('./bot.cjs');
function createServer({key, execute = async options => { const steam = new Steam(); await steam.connect(); return run(steam, options); }} = {}) {
  if (!key || key.length < 32) throw new Error('API key must contain at least 32 characters');
  let busy = false;
  return http.createServer(async (req, res) => {
    const reply = (code, data) => { res.writeHead(code, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data)); };
    if (req.method === 'GET' && req.url === '/health') return reply(200, {ok: true});
    const supplied = Buffer.from(req.headers['x-api-key'] || '');
    const expected = Buffer.from(key);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return reply(401, {error: 'Unauthorized'});
    if (req.method !== 'POST' || req.url !== '/v1/run') return reply(404, {error: 'Not found'});
    if (busy) return reply(409, {error: 'A Steam run is already active'});
    busy = true;
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 1024) return reply(413, {error: 'Request body too large'});
      }
      let options;
      try { options = JSON.parse(body); } catch { return reply(400, {error: 'Expected JSON body'}); }
      if (!options || Array.isArray(options) || typeof options !== 'object' || Object.keys(options).some(k => k !== 'dryRun') || typeof options.dryRun !== 'boolean') return reply(400, {error: 'Body must be {"dryRun":true} or {"dryRun":false}'});
      reply(200, await execute(options));
    } catch (error) {
      // No raw HTTP request/response dumps or tokens are logged.
      console.error('Steam run failed:', error.message);
      reply(502, {error: error.message});
    } finally { busy = false; }
  });
}
if (require.main === module) {
  const server = createServer({key: state.apiKey()});
  server.requestTimeout = 300000;
  server.listen(3000, '0.0.0.0', () => console.log('Steam helper listening on port 3000 (Docker network only)'));
}
module.exports = {createServer};
