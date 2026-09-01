// One-time maintenance script: generates the "-thumb.jpg" variant (see
// lib/photoPaths.ts) for every existing capture that predates the thumbnail
// feature, so the timeline grid never has to fall back to a full-res download
// for old photos. Safe to re-run -- it skips any capture that already has a
// thumb, and uploads with `upsert: true` for the rest.
//
// Run: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfillThumbnails.ts
// (the service-role key bypasses RLS entirely -- treat it like a root password:
// read from the environment only, never written to disk, never logged)

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { toThumbPath } from '../lib/photoPaths';

const THUMB_WIDTH = 480;
const THUMB_QUALITY = 50;

function loadEnvFile(): void {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

async function main() {
  loadEnvFile();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('Set SUPABASE_SERVICE_ROLE_KEY before running this (Project Settings > API in Supabase).');
    process.exit(1);
  }

  // Service role bypasses RLS, so there's no per-user session/userId here -- this
  // queries and lists across the whole `captures` bucket directly.
  const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // CAPTURE_PATHS lets the caller supply the list directly (e.g. from `supabase db
  // query`) when the service_role key lacks a table-level GRANT on public.captures --
  // service_role bypasses RLS but still needs that grant, which this project's
  // migrations never added. Falls back to querying the table normally otherwise.
  let paths: string[];
  const capturePathsEnv = process.env.CAPTURE_PATHS;
  if (capturePathsEnv) {
    paths = capturePathsEnv.split(',').map((p: string) => p.trim()).filter(Boolean);
  } else {
    const { data: captures, error: capturesError } = await supabase.from('captures').select('storage_path');
    if (capturesError) {
      console.error('Failed to list captures', capturesError);
      process.exit(1);
    }
    paths = (captures ?? []).map((c) => c.storage_path as string);
  }

  // Captures are stored as `${userId}/filename`, and list() only lists one folder
  // at a time (not recursive) -- so list each distinct user folder once and build
  // a full-path set, instead of one existence-check per photo.
  const userFolders = Array.from(new Set(paths.map((p) => p.split('/')[0])));
  const existingPaths = new Set<string>();
  for (const folder of userFolders) {
    const { data: existingObjects, error: listError } = await supabase.storage.from('captures').list(folder, { limit: 1000 });
    if (listError) {
      console.error('Failed to list existing storage objects', folder, listError);
      process.exit(1);
    }
    (existingObjects ?? []).forEach((o) => existingPaths.add(`${folder}/${o.name}`));
  }

  const missing = paths.filter((p) => !existingPaths.has(toThumbPath(p)));

  console.log(`${paths.length} total captures, ${paths.length - missing.length} have a thumbnail, ${missing.length} missing.`);

  if (process.argv.includes('--check')) {
    missing.forEach((p) => console.log(`missing thumb: ${p}`));
    return;
  }

  let succeeded = 0;
  let failed = 0;
  for (const storagePath of missing) {
    const thumbPath = toThumbPath(storagePath);
    try {
      const { data: blob, error: downloadError } = await supabase.storage.from('captures').download(storagePath);
      if (downloadError || !blob) throw downloadError ?? new Error('empty download');
      const buffer = Buffer.from(await blob.arrayBuffer());
      const thumbBuffer = await sharp(buffer).resize({ width: THUMB_WIDTH }).jpeg({ quality: THUMB_QUALITY }).toBuffer();
      const { error: uploadError } = await supabase.storage
        .from('captures')
        .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      succeeded += 1;
      console.log(`ok   ${storagePath}`);
    } catch (err) {
      failed += 1;
      console.error(`fail ${storagePath}`, err);
    }
  }

  console.log(`Done. ${succeeded} thumbnails created, ${failed} failed.`);
}

main();
