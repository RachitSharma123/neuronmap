/**
 * Seed script — run with: npm run seed
 * Seeds 387 terms from data/ai-terms.json into Supabase.
 * Only run once! Duplicate names will be skipped.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envFile = readFileSync(resolve(__dirname, "../.env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const data = JSON.parse(
  readFileSync(resolve(__dirname, "../data/ai-terms.json"), "utf-8")
);

const terms: {
  id: number;
  name: string;
  full_name: string;
  category: string;
  definition: string;
  connections: string[];
}[] = data.terms;

console.log(`Seeding ${terms.length} terms...`);

// Insert terms first (skip duplicates)
const termRows = terms.map((t) => ({
  name: t.name,
  full_name: t.full_name,
  category: t.category,
  definition: t.definition,
}));

const CHUNK = 50;
let inserted = 0;

for (let i = 0; i < termRows.length; i += CHUNK) {
  const chunk = termRows.slice(i, i + CHUNK);
  const { error } = await supabase
    .from("terms")
    .upsert(chunk, { onConflict: "name", ignoreDuplicates: true });

  if (error) {
    console.error(`Error inserting chunk at ${i}:`, error.message);
  } else {
    inserted += chunk.length;
    process.stdout.write(`\r${inserted}/${terms.length} terms inserted`);
  }
}

console.log("\nFetching inserted term IDs...");

// Fetch all term IDs
const { data: dbTerms, error: fetchErr } = await supabase
  .from("terms")
  .select("id, name");

if (fetchErr || !dbTerms) {
  console.error("Failed to fetch terms:", fetchErr?.message);
  process.exit(1);
}

const nameToId = new Map(dbTerms.map((t) => [t.name.toLowerCase(), t.id]));

// Build connection rows
const connRows: { from_id: string; to_id: string; weight: number }[] = [];

for (const term of terms) {
  const fromId = nameToId.get(term.name.toLowerCase());
  if (!fromId) continue;

  for (const connName of term.connections) {
    const toId = nameToId.get(connName.toLowerCase());
    if (toId && toId !== fromId) {
      connRows.push({ from_id: fromId, to_id: toId, weight: 1 });
    }
  }
}

console.log(`Inserting ${connRows.length} connections...`);

let connInserted = 0;
for (let i = 0; i < connRows.length; i += CHUNK) {
  const chunk = connRows.slice(i, i + CHUNK);
  const { error } = await supabase
    .from("connections")
    .upsert(chunk, { onConflict: "from_id,to_id", ignoreDuplicates: true });

  if (error) {
    console.error(`Connection chunk error at ${i}:`, error.message);
  } else {
    connInserted += chunk.length;
    process.stdout.write(`\r${connInserted}/${connRows.length} connections inserted`);
  }
}

console.log("\nSeed complete!");
