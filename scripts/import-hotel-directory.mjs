// Imports the hotel_import CSV extracts into Supabase (service role).
//
//   node scripts/import-hotel-directory.mjs [--dir /path/to/hotel_import] [--skip-hotels]
//
// Streams the files (never loads hotels_filtered.csv into memory) and
// upserts in batches, so re-runs are idempotent and a crashed run can
// simply be restarted. Requires migration 20260622100063 applied first.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const DIR = dirIdx >= 0 ? args[dirIdx + 1] : '/Users/sudeepsharma/Downloads/hotel_import';
const SKIP_HOTELS = args.includes('--skip-hotels');
const BATCH = 1000;

// ── env ──────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── tiny RFC-4180 streaming CSV reader ───────────────────────
async function* csvRows(file) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let header = null;
  let pending = ''; // accumulates lines when a quoted field spans newlines
  for await (const rawLine of rl) {
    const line = pending ? pending + '\n' + rawLine : rawLine;
    const fields = parseCsvLine(line);
    if (fields === null) {
      pending = line; // unbalanced quotes — keep accumulating
      continue;
    }
    pending = '';
    if (!header) {
      header = fields.map((h) => h.trim());
      continue;
    }
    const row = {};
    header.forEach((h, i) => (row[h] = (fields[i] ?? '').trim()));
    yield row;
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  if (inQ) return null; // field continues on next line
  out.push(cur);
  return out;
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
// Junk coordinates overflow numeric(9,6) — null anything out of range.
const lat = (v) => {
  const n = num(v);
  return n != null && Math.abs(n) <= 90 ? n : null;
};
const lng = (v) => {
  const n = num(v);
  return n != null && Math.abs(n) <= 180 ? n : null;
};

const STAR_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
};
function parseStars(v) {
  if (!v) return null;
  const direct = parseInt(v, 10);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 5) return direct;
  const m = v.toLowerCase().match(/^(one|two|three|four|five)(andahalf)?star$/);
  if (!m) return null;
  let stars = STAR_WORDS[m[1]];
  if (m[2]) stars = Math.min(5, stars + 1); // ThreeAndAHalf → 4
  return stars;
}

async function upsertBatch(table, rows, onConflict) {
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict });
    if (!error) return;
    if (attempt >= 3) throw new Error(`${table} batch failed: ${error.message}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

// ── 1. countries ─────────────────────────────────────────────
console.log('Importing countries…');
const countryCodeByName = new Map(); // lower(name) → code
{
  const byCode = new Map(); // dedupe: file may repeat a code with name variants
  for await (const r of csvRows(path.join(DIR, 'countries.csv'))) {
    if (!r.country_code || !r.country_name) continue;
    const code = r.country_code.toUpperCase();
    if (!byCode.has(code)) byCode.set(code, { code, name: r.country_name });
    // every name variant maps to the code, even when not the kept row
    countryCodeByName.set(r.country_name.toLowerCase(), code);
  }
  // unique names too — geo_countries.name has a UNIQUE constraint
  const seenNames = new Set();
  const rows = [...byCode.values()].filter((c) => {
    const k = c.name.toLowerCase();
    if (seenNames.has(k)) return false;
    seenNames.add(k);
    return true;
  });
  await upsertBatch('geo_countries', rows, 'code');
  console.log(`  ${rows.length} countries`);
}

// ── 2. cities ────────────────────────────────────────────────
console.log('Importing cities…');
{
  const seen = new Set(); // case-insensitive dedupe within the file
  let batch = [];
  let total = 0;
  for await (const r of csvRows(path.join(DIR, 'cities.csv'))) {
    const code = countryCodeByName.get((r.country_name || '').toLowerCase());
    const name = r.city_name;
    if (!code || !name) continue;
    const key = `${code}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    batch.push({
      country_code: code,
      name,
      state_region: r.state_region || null,
      latitude: lat(r.latitude),
      longitude: lng(r.longitude),
      source: 'import',
    });
    if (batch.length >= BATCH) {
      await upsertBatch('geo_cities', batch, 'country_code,name');
      total += batch.length;
      batch = [];
      if (total % 10000 === 0) console.log(`  ${total} cities…`);
    }
  }
  if (batch.length) {
    await upsertBatch('geo_cities', batch, 'country_code,name');
    total += batch.length;
  }
  console.log(`  ${total} cities`);
}

if (SKIP_HOTELS) {
  console.log('Skipping hotels (--skip-hotels). Done.');
  process.exit(0);
}

// ── 3. hotels ────────────────────────────────────────────────
// City lookup map: fetch all geo_cities ids (paged).
console.log('Building city map…');
const cityIdByKey = new Map();
{
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase
      .from('geo_cities')
      .select('id,country_code,name')
      .range(from, from + BATCH - 1);
    if (error) throw new Error(error.message);
    for (const c of data) cityIdByKey.set(`${c.country_code}|${c.name.toLowerCase()}`, c.id);
    if (data.length < BATCH) break;
  }
  console.log(`  ${cityIdByKey.size} cities mapped`);
}

console.log('Importing hotels…');
{
  let batch = [];
  let total = 0;
  let skipped = 0;
  let unresolvedCity = 0;
  const seenIds = new Set(); // dup ids in one upsert batch are a PG error
  for await (const r of csvRows(path.join(DIR, 'hotels_filtered.csv'))) {
    if (!r.hotel_id || !r.name || !r.city) { skipped++; continue; }
    if (seenIds.has(r.hotel_id)) { skipped++; continue; }
    seenIds.add(r.hotel_id);
    const code = countryCodeByName.get((r.country || '').toLowerCase()) || null;
    const cityId = code ? (cityIdByKey.get(`${code}|${r.city.toLowerCase()}`) ?? null) : null;
    if (!cityId) unresolvedCity++;
    batch.push({
      source: 'import',
      source_hotel_id: r.hotel_id,
      name: r.name.slice(0, 300),
      country_code: code,
      city_id: cityId,
      city_name: r.city,
      address: r.address || null,
      postal_code: r.postal_code || null,
      latitude: lat(r.latitude),
      longitude: lng(r.longitude),
      star_rating: parseStars(r.star_rating),
      chain_brand: r.chain_brand || null,
    });
    if (batch.length >= BATCH) {
      await upsertBatch('hotel_directory', batch, 'source,source_hotel_id');
      total += batch.length;
      batch = [];
      if (total % 25000 === 0) console.log(`  ${total} hotels…`);
    }
  }
  if (batch.length) {
    await upsertBatch('hotel_directory', batch, 'source,source_hotel_id');
    total += batch.length;
  }
  console.log(`Done. ${total} hotels imported, ${skipped} skipped (missing fields), ${unresolvedCity} with unresolved city link (kept city_name text).`);
}
