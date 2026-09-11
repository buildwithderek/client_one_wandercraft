/**
 * WanderCraft — roster reveal
 * ===========================
 *
 * Adds embargoed creators to js/data/creators.js and fixes the roster count
 * everywhere it is hard-coded.
 *
 * The count is why this script exists. Adding entries by hand ships the new
 * roster with the old number still printed under it in six other places: the
 * homepage hero stat, the sponsors stat rail, the og: and twitter:
 * descriptions, the Organization JSON-LD, and two lines of llms.txt.
 *
 * Where the creators come from (first match wins):
 *
 *   1. $PENDING_CREATORS   a JSON array. This is how the scheduled reveal in
 *                          .github/workflows/reveal-creators.yml feeds it —
 *                          the data lives in an encrypted repo secret, so it
 *                          is never readable in this public repo before the
 *                          announcement.
 *   2. data/pending-creators.json   gitignored local fallback, for revealing
 *                          by hand if the scheduled run ever fails.
 *
 * Usage:
 *   node scripts/reveal-creators.mjs              apply
 *   node scripts/reveal-creators.mjs --dry-run    report only, write nothing
 *
 * Idempotent: creators already present are skipped, and if every one is
 * already in place it exits 0 having changed nothing. All-or-nothing: if any
 * single edit does not match what it expects, nothing is written at all.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');
const CREATORS_FILE = 'js/data/creators.js';

/** Field order on each line, matching the existing entries in creators.js. */
const FIELDS = [
  'id', 'name', 'role', 'mcUsername', 'twitchUsername',
  'youtubeHandle', 'youtubeChannelId', 'tiktokHandle',
  'instagramHandle', 'discordInvite',
];

const die = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };

/* ---------- load the pending roster ---------- */

async function loadPending() {
  const raw = process.env.PENDING_CREATORS;
  if (raw && raw.trim()) {
    try { return { source: 'PENDING_CREATORS secret', list: JSON.parse(raw) }; }
    catch (e) { die(`PENDING_CREATORS is not valid JSON: ${e.message}`); }
  }
  try {
    const text = await readFile(resolve(REPO_ROOT, 'data/pending-creators.json'), 'utf8');
    return { source: 'data/pending-creators.json', list: JSON.parse(text) };
  } catch {
    die('No pending creators found. Set $PENDING_CREATORS or create data/pending-creators.json.');
  }
}

/** One creator → one line, in the same shape as the entries already in the file. */
function formatEntry(c) {
  if (!c.id || !c.name) die(`Entry missing id or name: ${JSON.stringify(c)}`);
  const parts = FIELDS.map((f) => {
    const v = c[f] ?? null;
    return `${f}: ${v === null ? 'null' : `'${String(v).replace(/'/g, "\\'")}'`}`;
  });
  return `  { ${parts.join(', ')} },`;
}

/* ---------- apply ---------- */

const { source, list } = await loadPending();
if (!Array.isArray(list) || list.length === 0) die('Pending roster is empty.');

const files = new Map();
const load = async (f) => {
  if (!files.has(f)) files.set(f, await readFile(resolve(REPO_ROOT, f), 'utf8'));
  return files.get(f);
};

let creators = await load(CREATORS_FILE);

const before = (creators.match(/^ {2}\{ id: '/gm) || []).length;
if (before === 0) die(`Could not find any creator entries in ${CREATORS_FILE}.`);

const fresh = list.filter((c) => !creators.includes(`{ id: '${c.id}'`));
const skipped = list.length - fresh.length;

console.log(`Roster reveal — source: ${source}`);
console.log(`  current roster: ${before}`);
console.log(`  pending:        ${list.length}${skipped ? ` (${skipped} already present)` : ''}`);

if (fresh.length === 0) {
  console.log('\nNothing to do — every pending creator is already on the roster.');
  process.exit(0);
}

// Insert just before the closing bracket of the CREATORS array.
const close = creators.indexOf('\n];');
if (close < 0) die(`Could not find the end of the CREATORS array in ${CREATORS_FILE}.`);
creators = creators.slice(0, close + 1)
  + fresh.map(formatEntry).join('\n') + '\n'
  + creators.slice(close + 1);

const after = before + fresh.length;
files.set(CREATORS_FILE, creators);
for (const c of fresh) console.log(`  + ${c.name} (${c.mcUsername || 'no IGN'})`);

/* ---------- the count, everywhere it is written down ---------- */

const WORDS = { 14: 'Fourteen', 15: 'Fifteen', 16: 'Sixteen', 17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen', 20: 'Twenty' };

const COUNT_EDITS = [
  { file: CREATORS_FILE, what: 'docblock', from: `The real WanderCraft ${before},`, to: `The real WanderCraft ${after},` },
  { file: 'index.html', what: 'hero stat', from: `<dt>Creators</dt>\n          <dd>${before}</dd>`, to: `<dt>Creators</dt>\n          <dd>${after}</dd>` },
  { file: 'index.html', what: 'og:/twitter: descriptions', from: `Meet the ${before} creators`, to: `Meet the ${after} creators`, count: 2 },
  { file: 'index.html', what: 'Organization JSON-LD', from: `a collective of ${before} creators`, to: `a collective of ${after} creators` },
  { file: 'sponsors.html', what: 'sponsor stat rail', from: `<dt>Creators</dt>\n              <dd>${before}</dd>`, to: `<dt>Creators</dt>\n              <dd>${after}</dd>` },
  { file: 'llms.txt', what: 'summary line', from: `${WORDS[before]} creators stream`, to: `${WORDS[after]} creators stream` },
  { file: 'llms.txt', what: 'collective bullet', from: `— ${before} creators, led by`, to: `— ${after} creators, led by` },
];

const problems = [];
for (const e of COUNT_EDITS) {
  const text = await load(e.file);
  const want = e.count ?? 1;
  const found = text.split(e.from).length - 1;
  if (found === want) {
    files.set(e.file, text.split(e.from).join(e.to));
    console.log(`  ✓ count ${before} → ${after} in ${e.what} (${e.file})`);
  } else if (text.includes(e.to)) {
    console.log(`  · count already ${after} in ${e.what}`);
  } else {
    problems.push(`${e.file}: expected ${want} occurrence(s) of ${JSON.stringify(e.from.slice(0, 44))}, found ${found}`);
  }
}

if (problems.length) {
  console.error('\nRefusing to write — the repo is not in the state this script expects:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\nNothing was changed.');
  process.exit(1);
}

if (DRY_RUN) {
  console.log(`\n--dry-run: would add ${fresh.length} creator(s) and set the count to ${after}. Nothing written.`);
  process.exit(0);
}

for (const [f, content] of files) await writeFile(resolve(REPO_ROOT, f), content);
console.log(`\nRevealed ${fresh.length} creator(s). Roster is now ${after}.`);
