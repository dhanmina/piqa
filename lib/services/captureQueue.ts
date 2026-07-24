/**
 * Offline-first capture queue — spec §4, priority #1.
 *
 * The promise: capture NEVER fails for lack of signal. The moment a shot is
 * "used" it is persisted to app document storage with its captured_at
 * timestamp and a journal entry; everything after that (compress → thumb
 * upload → full upload → DB row) is retried with exponential backoff until
 * it succeeds. CAPTURE TIME IS SUBMISSION TIME: the submissions row carries
 * captured_at, so an 11:58pm shot syncing at 7am is still valid.
 *
 * Storage choice — AsyncStorage journal, not SQLite: the journal is a handful
 * of small JSON entries with a single JS writer (all mutations funnel through
 * one serialized persist()), while the actual photo bytes live as files under
 * Paths.document/captures/. SQLite would add a native module for no extra
 * durability where it matters (the image file + a <2KB journal write).
 *
 * Failure taxonomy:
 *  - connectivity (offline, DNS, timeouts) → silent retry forever, UI shows
 *    "queued ↻" / "Saved — will upload". NEVER an error state.
 *  - real errors (storage policy denial, invalid session, duplicate) → item
 *    is 'blocked' and surfaced once via listener so the UI can toast + offer
 *    retry. Duplicates ("already submitted") resolve the item.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Network from "expo-network";
import { AppState } from "react-native";

import { capture } from "./analytics";
import { getConfig } from "./config";
import { classifyImage, NSFW_REJECTION_COPY } from "../utils/nsfw";
import { supabase } from "./supabase";

// Image pipeline. Piqa is a photos app, so the full-res is sized to stay sharp
// fullscreen on high-DPI phones (a 4:5 portrait fills ~1600px tall on a 3x
// display) with headroom for pinch-zoom, at a quality that avoids visible JPEG
// artifacts.
//
// The thumbnail is NOT a tiny placeholder — it is the image every grid actually
// displays (gallery tiles, the full-width PotD hero, archive, profile). On a 3x
// phone a 2-col tile is ~640px wide and the PotD hero spans ~1290px, so a 300px
// thumb was being upscaled 2–5x and read as blurry. In a photos app that alone
// reads as "broken". The thumb long edge is sized so a tile is at/above 1:1 and
// the hero is only mildly upscaled; full-res still carries fullscreen + zoom.
const FULL_LONG_EDGE = 2048;
const THUMB_LONG_EDGE = 1080;
const FULL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;
// Every shared photo is 4:5 portrait (width/height). We bake this crop into the
// uploaded bytes so the stored asset matches the capture preview and every grid
// exactly — no per-image reflow, uniform frames everywhere. The local original
// is kept untouched as the private archive copy.
const PHOTO_ASPECT = 4 / 5;

const JOURNAL_KEY = "piqa.captureQueue.v1";
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 5 * 60_000;

export type CaptureKind = "daily" | "free";

export type QueueItem = {
  id: string;
  kind: CaptureKind;
  dropId: string | null;
  dropsAt: string | null;
  /** ISO timestamp of the capture moment — THE submission time. */
  capturedAt: string;
  width: number;
  height: number;
  originalUri: string;
  fullUri: string | null;
  thumbUri: string | null;
  thumbUploaded: boolean;
  fullUploaded: boolean;
  rowInserted: boolean;
  /** NSFW gate passed — checked once, before any upload (spec §12). */
  nsfwPassed: boolean;
  attempts: number;
  nextAttemptAt: number;
  status: "pending" | "blocked" | "done";
  /** 'network' failures are silent; 'rejected' = content gate; else real error. */
  lastErrorKind: "network" | "fatal" | "rejected" | null;
  lastError: string | null;
};

export type QueueEvent =
  | { type: "saved"; item: QueueItem }
  | { type: "progress"; item: QueueItem }
  | { type: "done"; item: QueueItem }
  | { type: "duplicate"; item: QueueItem }
  | { type: "blocked"; item: QueueItem };

type Listener = (event: QueueEvent) => void;

let items: QueueItem[] = [];
let loaded = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let persistChain: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();

function emit(event: QueueEvent) {
  listeners.forEach((l) => l(event));
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueueItems(): QueueItem[] {
  return items;
}

export function getPendingItemForDrop(dropId: string): QueueItem | undefined {
  return items.find((i) => i.kind === "daily" && i.dropId === dropId && i.status !== "done");
}

function persist(): Promise<void> {
  // Serialize journal writes — single writer, last state wins.
  persistChain = persistChain.then(() =>
    AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(items)).catch(() => {}),
  );
  return persistChain;
}

function capturesDir(): Directory {
  const dir = new Directory(Paths.document, "captures");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function isNetworkError(message: string): boolean {
  return /network|fetch|timeout|timed out|connection|socket|unreachable|abort|offline|ENOTFOUND|ECONN/i.test(
    message,
  );
}

async function classifyFailure(err: unknown): Promise<{ kind: "network" | "fatal"; message: string }> {
  const message = err instanceof Error ? err.message : String(err);
  if (isNetworkError(message)) return { kind: "network", message };
  try {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || net.isInternetReachable === false) {
      return { kind: "network", message };
    }
  } catch {
    return { kind: "network", message };
  }
  return { kind: "fatal", message };
}

/**
 * Step 1 of the sacred path. Copies the capture into document storage and
 * journals it — fast, local-only, no network involved. Everything else is
 * background work.
 */
export async function enqueueCapture(input: {
  uri: string;
  width: number;
  height: number;
  kind: CaptureKind;
  dropId?: string | null;
  dropsAt?: string | null;
  capturedAt: string;
}): Promise<QueueItem> {
  const id = Crypto.randomUUID();
  const original = new File(capturesDir(), `${id}.jpg`);
  await new File(input.uri).copy(original);

  // One public slot per drop: if a daily capture is already queued for this
  // drop, the new shot is archived instead of becoming a backdoor replace.
  const kind: CaptureKind =
    input.kind === "daily" && input.dropId && getPendingItemForDrop(input.dropId)
      ? "free"
      : input.kind;

  const item: QueueItem = {
    id,
    kind,
    dropId: input.dropId ?? null,
    dropsAt: input.dropsAt ?? null,
    capturedAt: input.capturedAt,
    width: input.width,
    height: input.height,
    originalUri: original.uri,
    fullUri: null,
    thumbUri: null,
    thumbUploaded: false,
    fullUploaded: false,
    rowInserted: false,
    nsfwPassed: false,
    attempts: 0,
    nextAttemptAt: 0,
    status: "pending",
    lastErrorKind: null,
    lastError: null,
  };

  items = [...items, item];
  await persist();
  emit({ type: "saved", item });
  void kick();
  return item;
}

/**
 * Center-crop rectangle that fits the source into 4:5 portrait — exactly what
 * `contentFit: cover` shows in the capture preview, so the baked crop is WYSIWYG.
 * Too wide → trim the sides; too tall → trim top/bottom.
 */
function cropTo45(width: number, height: number) {
  if (width / height > PHOTO_ASPECT) {
    const cropW = Math.round(height * PHOTO_ASPECT);
    return { originX: Math.round((width - cropW) / 2), originY: 0, width: cropW, height };
  }
  const cropH = Math.round(width / PHOTO_ASPECT);
  return { originX: 0, originY: Math.round((height - cropH) / 2), width, height: cropH };
}

async function compressTo(item: QueueItem, longEdge: number, quality: number, suffix: string): Promise<string> {
  const context = ImageManipulator.manipulate(item.originalUri);
  // Crop to the canonical 4:5 frame first, then the cropped image is always
  // portrait, so the long edge is its height.
  context.crop(cropTo45(item.width, item.height));
  context.resize({ height: longEdge });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  // Move out of cache into document storage so the queue survives cache eviction.
  const target = new File(capturesDir(), `${item.id}_${suffix}.jpg`);
  if (target.exists) target.delete();
  await new File(saved.uri).move(target);
  return target.uri;
}

function storagePaths(item: QueueItem, userId: string): { full: string; thumb: string } {
  if (item.kind === "daily" && item.dropId) {
    return {
      full: `${item.dropId}/${userId}.jpg`,
      thumb: `${item.dropId}/${userId}_thumb.jpg`,
    };
  }
  return {
    full: `free/${userId}/${item.id}.jpg`,
    thumb: `free/${userId}/${item.id}_thumb.jpg`,
  };
}

async function uploadFile(localUri: string, remotePath: string): Promise<void> {
  const bytes = await new File(localUri).bytes();
  const { error } = await supabase.storage
    .from("submissions")
    .upload(remotePath, bytes.buffer as ArrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
}

async function insertRow(item: QueueItem, userId: string): Promise<"inserted" | "duplicate"> {
  const paths = storagePaths(item, userId);
  if (item.kind === "daily" && item.dropId) {
    const quickDrawMinutes = await getConfig("quick_draw_minutes");
    const quickDraw =
      item.dropsAt !== null &&
      new Date(item.capturedAt).getTime() - new Date(item.dropsAt).getTime() <=
        quickDrawMinutes * 60_000;
    const { error } = await supabase.from("submissions").insert({
      drop_id: item.dropId,
      user_id: userId,
      image_path: paths.full,
      thumb_path: paths.thumb,
      captured_at: item.capturedAt, // capture time, never upload time
      quick_draw: quickDraw,
    });
    if (error) {
      if (error.code === "23505") return "duplicate";
      throw new Error(error.message);
    }
    capture("shot_entered", { quick_draw: quickDraw });
    return "inserted";
  }
  const { error } = await supabase.from("free_shots").insert({
    user_id: userId,
    image_path: paths.full,
    thumb_path: paths.thumb,
    captured_at: item.capturedAt,
  });
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(error.message);
  }
  return "inserted";
}

function cleanupIntermediates(item: QueueItem) {
  for (const uri of [item.thumbUri, item.fullUri]) {
    try {
      if (uri) new File(uri).delete();
    } catch {
      // best-effort cleanup
    }
  }
}

async function processItem(item: QueueItem): Promise<void> {
  try {
    if (!item.thumbUri) {
      item.thumbUri = await compressTo(item, THUMB_LONG_EDGE, THUMB_QUALITY, "thumb");
      await persist();
    }
    if (!item.fullUri) {
      item.fullUri = await compressTo(item, FULL_LONG_EDGE, FULL_QUALITY, "full");
      await persist();
    }

    // NSFW pre-upload gate (spec §12): decide BEFORE any upload so flagged bytes
    // are never sent. A flagged shot is rejected outright (not a retry) and
    // dropped from the queue, so Today returns to the Shoot card to reshoot.
    if (!item.nsfwPassed) {
      const { flagged } = await classifyImage(item.thumbUri ?? item.originalUri);
      if (flagged) {
        item.status = "blocked";
        item.lastErrorKind = "rejected";
        item.lastError = NSFW_REJECTION_COPY;
        emit({ type: "blocked", item });
        cleanupIntermediates(item);
        try {
          new File(item.originalUri).delete();
        } catch {
          // best-effort — never keep flagged bytes around
        }
        items = items.filter((i) => i.id !== item.id);
        await persist();
        return;
      }
      item.nsfwPassed = true;
      await persist();
    }

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new Error("No session — sign in to upload");

    // Daily uploads write to a deterministic {drop}/{user} path with upsert —
    // so before touching storage, bail out if a submission row already exists
    // (otherwise a duplicate capture would silently overwrite the first shot).
    if (item.kind === "daily" && item.dropId && !item.rowInserted) {
      const { data: existing, error: checkError } = await supabase
        .from("submissions")
        .select("id")
        .eq("drop_id", item.dropId)
        .eq("user_id", userId)
        .maybeSingle();
      if (checkError) throw new Error(checkError.message);
      if (existing) {
        item.rowInserted = true;
        item.status = "done";
        await persist();
        emit({ type: "duplicate", item });
        cleanupIntermediates(item);
        items = items.filter((i) => i.id !== item.id);
        await persist();
        return;
      }
    }

    const paths = storagePaths(item, userId);
    if (!item.thumbUploaded) {
      await uploadFile(item.thumbUri, paths.thumb); // thumb first (spec §4)
      item.thumbUploaded = true;
      item.lastErrorKind = null;
      await persist();
      emit({ type: "progress", item });
    }
    if (!item.fullUploaded) {
      await uploadFile(item.fullUri, paths.full);
      item.fullUploaded = true;
      await persist();
      emit({ type: "progress", item });
    }
    if (!item.rowInserted) {
      const outcome = await insertRow(item, userId);
      item.rowInserted = true;
      item.status = "done";
      await persist();
      emit({ type: outcome === "duplicate" ? "duplicate" : "done", item });
    }

    // Success: drop the compressed intermediates, keep the original as the
    // local archive copy, and retire the journal entry.
    cleanupIntermediates(item);
    items = items.filter((i) => i.id !== item.id);
    await persist();
  } catch (err) {
    const { kind, message } = await classifyFailure(err);
    item.attempts += 1;
    item.lastErrorKind = kind;
    item.lastError = message;
    if (kind === "network") {
      // Connectivity is never an error — back off and wait for signal.
      const delay =
        Math.min(BACKOFF_BASE_MS * 2 ** Math.min(item.attempts, 7), BACKOFF_MAX_MS) +
        Math.random() * 1_000;
      item.nextAttemptAt = Date.now() + delay;
      await persist();
      emit({ type: "progress", item });
    } else {
      item.status = "blocked";
      await persist();
      emit({ type: "blocked", item });
    }
  }
}

/** Re-arm blocked items (called from the retry affordance in the UI). */
export async function retryBlocked(): Promise<void> {
  let changed = false;
  for (const item of items) {
    if (item.status === "blocked") {
      item.status = "pending";
      item.nextAttemptAt = 0;
      item.lastErrorKind = null;
      changed = true;
    }
  }
  if (changed) {
    await persist();
    void kick();
  }
}

async function kick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    let next: QueueItem | undefined;
    while (
      (next = items.find((i) => i.status === "pending" && i.nextAttemptAt <= Date.now()))
    ) {
      await processItem(next);
    }
  } finally {
    running = false;
  }
  scheduleNextWake();
}

function scheduleNextWake() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const future = items
    .filter((i) => i.status === "pending")
    .map((i) => i.nextAttemptAt)
    .sort((a, b) => a - b)[0];
  if (future !== undefined) {
    timer = setTimeout(() => void kick(), Math.max(250, future - Date.now()));
  }
}

/**
 * Call once at app start. Restores the journal (queue survives restarts) and
 * wires the wake-up sources: connectivity regain + app foregrounding.
 */
export async function initCaptureQueue(): Promise<void> {
  if (loaded) return;
  loaded = true;

  try {
    const raw = await AsyncStorage.getItem(JOURNAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueueItem[];
      items = parsed.filter((i) => i.status !== "done");
      // Anything mid-flight when the app died retries immediately.
      items.forEach((i) => {
        if (i.status === "pending") i.nextAttemptAt = 0;
      });
    }
  } catch {
    items = [];
  }

  Network.addNetworkStateListener((state) => {
    if (state.isConnected) void kick();
  });
  AppState.addEventListener("change", (state) => {
    if (state === "active") void kick();
  });

  void kick();
}
