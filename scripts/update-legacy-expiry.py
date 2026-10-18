#!/usr/bin/env python3
"""Add Store expiry metadata to the original single-account SSH claim script.

Does not read auth.json or change login/claim behavior. Run on the Docker host.
"""
import argparse
import datetime
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path


def patch(text):
    if '// steam-offer-expiry-v1' in text:
        return text
    replacements = [
        ('  const results = [];',
         '  const results = [];\n  // steam-offer-expiry-v1\n  const offerDeadlines = new Map();'),
        ('      const html = await response.text();',
         '      const html = await response.text();\n'
         "      offerDeadlines.set(appId, require('./offer-info.cjs').offerEnd(html, appId));"),
        ("console.log(JSON.stringify({mode: claim ? 'claim' : 'dry_run', results}));",
         "console.log(JSON.stringify({mode: claim ? 'claim' : 'dry_run', "
         "results: results.map(g => ({...g, expiresAt: offerDeadlines.get(String(g.appId)) || null}))}));")
    ]
    for old, new in replacements:
        if text.count(old) != 1:
            raise ValueError('Script differs; no changes made. Missing/duplicate anchor: ' + old)
        text = text.replace(old, new, 1)
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', default='/srv/projects/n8n/steam-auth')
    ap.add_argument('--container', default='n8n-steam-runner-1')
    ap.add_argument('--container-root', default='/home/runner/steam-auth')
    ap.add_argument('--ref', required=True, help='Exact 40-character GitHub commit SHA')
    args = ap.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.ref):
        raise SystemExit('--ref must be an exact commit SHA')
    root = Path(args.root)
    claim = root / 'claim.cjs'
    old = claim.read_text()
    updated = patch(old)  # Validate anchors before any changes.
    url = f'https://raw.githubusercontent.com/Ebnhussein/n8n-steam-free-games/{args.ref}/src/parse.cjs'
    with urllib.request.urlopen(url, timeout=30) as response:
        module = response.read().decode('utf-8')
    with tempfile.TemporaryDirectory(prefix='.steam-expiry-', dir=root) as temp:
        temp = Path(temp)
        os.chmod(temp, 0o755)
        candidate = temp / 'claim.cjs'
        parser = temp / 'offer-info.cjs'
        candidate.write_text(updated)
        parser.write_text(module)
        os.chmod(candidate, 0o644)
        os.chmod(parser, 0o644)
        for path in [candidate, parser]:
            relative = path.relative_to(root)
            subprocess.run([
                'docker', 'exec', args.container, 'node', '--check',
                str(Path(args.container_root) / relative)
            ], check=True)
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        shutil.copy2(claim, str(claim) + '.bak-' + stamp)
        dest = root / 'offer-info.cjs'
        if dest.exists():
            shutil.copy2(dest, str(dest) + '.bak-' + stamp)
        shutil.copyfile(parser, dest)
        os.chmod(dest, 0o644)
        # Preserve original ownership and mode of the existing claim script.
        claim.write_text(updated)
    print('Expiry metadata installed; auth.json was not read or changed.')
    print('Next: update n8n nodes 05 and 08 using the legacy code files.')


if __name__ == '__main__':
    main()
