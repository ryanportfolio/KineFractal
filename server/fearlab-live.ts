// FearLab live-artifact bucket reader.
//
// The Railway worker publishes nightly artifacts to an S3-compatible Railway
// bucket (range repo, worker/store.py S3Store + worker/eod.py):
//
//   <env-prefix>/latest.json                              pointer, put LAST (atomic flip)
//   <env-prefix>/runs/<trading_date>/board/v1/board.json  board.v1
//   <env-prefix>/runs/<trading_date>/combos/v1/<key>.json combo.v1
//   <env-prefix>/runs/<trading_date>/signals/v1/<date>.json + latest.json    signals.v1
//   <env-prefix>/runs/<trading_date>/charts/v1/<SYM>.json chart.v1
//   <env-prefix>/runs/<trading_date>/manifest.json
//
// GOTCHA: the pointer's `prefix` field ("runs/<date>") excludes the
// FEARLAB_S3_PREFIX env prefix — the full object key joins BOTH.
//
// Consumers MUST resolve artifacts only through latest.json: the worker puts
// the pointer last, so readers always see a complete run.
//
// Config comes from the SAME env names the worker uses (never VITE_-prefixed
// — Vite inlines VITE_* into the client bundle, which would leak the bucket
// credentials): FEARLAB_S3_BUCKET (required), AWS_ENDPOINT_URL_S3 or
// AWS_ENDPOINT_URL (required — Railway buckets are S3-compatible, not AWS),
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION (standard SDK vars),
// FEARLAB_S3_PREFIX (optional key prefix).
//
// Failure model: env unset or bucket unreachable => this module reports
// "unavailable" cleanly (no throw at import, no boot crash); routes then
// serve the static-snapshot fallback with live:false.

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import type { LatestPointer } from "@shared/fearlab-contracts";

// ---------------------------------------------------------------------------
// Config (read lazily; import never throws)
// ---------------------------------------------------------------------------

interface BucketConfig {
  bucket: string;
  endpoint: string;
  prefix: string; // "" or "some/prefix" (no leading/trailing slash)
}

function readConfig(): BucketConfig | null {
  const bucket = process.env.FEARLAB_S3_BUCKET;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL;
  if (!bucket || !endpoint) return null;
  const prefix = (process.env.FEARLAB_S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
  return { bucket, endpoint, prefix };
}

let client: S3Client | null = null;
let clientConfig: BucketConfig | null = null;

function getClient(): { client: S3Client; config: BucketConfig } | null {
  const config = readConfig();
  if (!config) return null;
  if (!client || !clientConfig || clientConfig.bucket !== config.bucket || clientConfig.endpoint !== config.endpoint) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: process.env.AWS_REGION || "auto",
      forcePathStyle: true, // Railway bucket endpoints are path-style
      // Credentials come from the standard AWS_ACCESS_KEY_ID /
      // AWS_SECRET_ACCESS_KEY env vars via the SDK's default provider chain.
    });
    clientConfig = config;
  }
  return { client, config };
}

/** True when the bucket env is configured (says nothing about reachability). */
export function isConfigured(): boolean {
  return readConfig() !== null;
}

// ---------------------------------------------------------------------------
// Low-level object fetch
// ---------------------------------------------------------------------------

/** Error classification for route status mapping. */
export type FetchFailure = "unavailable" | "not_found";
export type FetchResult<T> = { ok: true; data: T } | { ok: false; reason: FetchFailure };

function isNotFoundError(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === "NoSuchKey" ||
    e?.name === "NotFound" ||
    e?.$metadata?.httpStatusCode === 404
  );
}

async function getObjectText(key: string): Promise<FetchResult<string>> {
  const ctx = getClient();
  if (!ctx) return { ok: false, reason: "unavailable" };
  try {
    const resp = await ctx.client.send(
      new GetObjectCommand({ Bucket: ctx.config.bucket, Key: key })
    );
    const raw = await resp.Body?.transformToString("utf-8");
    if (raw == null || raw === "") return { ok: false, reason: "unavailable" };
    return { ok: true, data: raw };
  } catch (err) {
    if (isNotFoundError(err)) return { ok: false, reason: "not_found" };
    console.error(`[FearLab live] bucket read failed for ${key}:`, (err as Error)?.message ?? err);
    return { ok: false, reason: "unavailable" };
  }
}

async function getObjectBytes(key: string): Promise<FetchResult<Buffer>> {
  const ctx = getClient();
  if (!ctx) return { ok: false, reason: "unavailable" };
  try {
    const resp = await ctx.client.send(
      new GetObjectCommand({ Bucket: ctx.config.bucket, Key: key })
    );
    const raw = await resp.Body?.transformToByteArray();
    if (raw == null || raw.length === 0) return { ok: false, reason: "unavailable" };
    return { ok: true, data: Buffer.from(raw) };
  } catch (err) {
    if (isNotFoundError(err)) return { ok: false, reason: "not_found" };
    console.error(`[FearLab live] bucket read failed for ${key}:`, (err as Error)?.message ?? err);
    return { ok: false, reason: "unavailable" };
  }
}

async function getObjectJson<T>(key: string): Promise<FetchResult<T>> {
  const res = await getObjectText(key);
  if (!res.ok) return res;
  try {
    return { ok: true, data: JSON.parse(res.data) as T };
  } catch (err) {
    console.error(`[FearLab live] invalid JSON for ${key}:`, (err as Error)?.message ?? err);
    return { ok: false, reason: "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Pointer cache (latest.json, ~60s TTL — worker publishes once per night)
// ---------------------------------------------------------------------------

const POINTER_TTL_MS = 60_000;
let pointerCache: { fetchedAt: number; pointer: LatestPointer } | null = null;

function pointerKey(config: BucketConfig): string {
  return config.prefix ? `${config.prefix}/latest.json` : "latest.json";
}

/** Resolve the latest-run pointer, cached ~60s. Null = unavailable/no run. */
export async function getLatestPointer(): Promise<LatestPointer | null> {
  const ctx = getClient();
  if (!ctx) return null;
  const now = Date.now();
  if (pointerCache && now - pointerCache.fetchedAt < POINTER_TTL_MS) {
    return pointerCache.pointer;
  }
  const res = await getObjectJson<LatestPointer>(pointerKey(ctx.config));
  if (!res.ok) {
    // Keep serving a previously-seen pointer through transient blips.
    return pointerCache?.pointer ?? null;
  }
  const p = res.data;
  if (!p || typeof p.trading_date !== "string" || typeof p.prefix !== "string") {
    console.error("[FearLab live] malformed latest.json pointer:", JSON.stringify(p)?.slice(0, 200));
    return pointerCache?.pointer ?? null;
  }
  pointerCache = { fetchedAt: now, pointer: p };
  return p;
}

// ---------------------------------------------------------------------------
// Artifact cache — keyed by (pointer generation, object key) so a pointer
// flip invalidates naturally. Artifacts under runs/<date>/ are immutable in
// practice (idempotent same-date overwrite only), so no per-entry TTL.
// ---------------------------------------------------------------------------

const ARTIFACT_CACHE_MAX = 128; // board + ~60 combos + ~20 charts + signals, with headroom
const artifactCache = new Map<string, unknown>();

function cachePut(key: string, value: unknown): void {
  if (artifactCache.size >= ARTIFACT_CACHE_MAX) {
    // Evict oldest-inserted entry (Map preserves insertion order).
    const oldest = artifactCache.keys().next().value;
    if (oldest !== undefined) artifactCache.delete(oldest);
  }
  artifactCache.set(key, value);
}

/**
 * Fetch one artifact of the latest run by run-relative path, e.g.
 * "board/v1/board.json" or "charts/v1/SPY.json". Cached per pointer
 * generation.
 */
export async function getRunArtifact<T>(relPath: string): Promise<FetchResult<T>> {
  const ctx = getClient();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const pointer = await getLatestPointer();
  if (!pointer) return { ok: false, reason: "unavailable" };
  // Full key = env prefix + pointer prefix ("runs/<date>") + rel path.
  const parts = [ctx.config.prefix, pointer.prefix, relPath].filter(Boolean);
  const key = parts.join("/");
  const cacheKey = `${pointer.generated}|${key}`;
  if (artifactCache.has(cacheKey)) {
    return { ok: true, data: artifactCache.get(cacheKey) as T };
  }
  const res = await getObjectJson<T>(key);
  if (res.ok) cachePut(cacheKey, res.data);
  return res;
}

/**
 * Fetch one artifact of the latest run as RAW TEXT (no JSON parse), e.g.
 * "charts-app/charts.html" or "charts-app/dashboard/data-spy-super.js".
 * NOT cached here — the charts-app proxy (server/fearlab-charts.ts) keeps its
 * own pointer-generation-keyed text cache so multi-hundred-KB chart payloads
 * never evict the small JSON artifacts from `artifactCache`.
 */
export async function getRunArtifactText(relPath: string): Promise<FetchResult<string>> {
  const ctx = getClient();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const pointer = await getLatestPointer();
  if (!pointer) return { ok: false, reason: "unavailable" };
  const parts = [ctx.config.prefix, pointer.prefix, relPath].filter(Boolean);
  return getObjectText(parts.join("/"));
}

/**
 * Fetch one artifact of the latest run as RAW BYTES (no text decode), e.g.
 * "charts-app/assets/fonts/orbitron.woff2". Binary-safe — the text getter's
 * utf-8 decode would corrupt woff2. Not cached here (see getRunArtifactText).
 */
export async function getRunArtifactBytes(relPath: string): Promise<FetchResult<Buffer>> {
  const ctx = getClient();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const pointer = await getLatestPointer();
  if (!pointer) return { ok: false, reason: "unavailable" };
  const parts = [ctx.config.prefix, pointer.prefix, relPath].filter(Boolean);
  return getObjectBytes(parts.join("/"));
}

/**
 * Fetch one artifact of a SPECIFIC dated run, bypassing the latest.json
 * pointer: key = <env-prefix>/runs/<date>/<relPath>. Needed for history reads
 * (e.g. signals/v1/<date>.json) — each run dir holds exactly ONE dated
 * signals file (its own trading date), so resolving history through the
 * latest pointer would always 404. Old run dirs are never deleted (the store
 * is overwrite-only), so history stays readable.
 *
 * Caveat: only the pointer flip guarantees a COMPLETE run — a crash
 * mid-publish for that date can leave a partial runs/<date>/ dir. Acceptable
 * for history reads (worst case: 404 on the missing artifact).
 */
export async function getDatedRunArtifact<T>(date: string, relPath: string): Promise<FetchResult<T>> {
  const ctx = getClient();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const parts = [ctx.config.prefix, `runs/${date}`, relPath].filter(Boolean);
  const key = parts.join("/");
  // Dated run artifacts are immutable once written (idempotent same-date
  // overwrite only), so the cache key needs no pointer generation.
  const cacheKey = `dated|${key}`;
  if (artifactCache.has(cacheKey)) {
    return { ok: true, data: artifactCache.get(cacheKey) as T };
  }
  const res = await getObjectJson<T>(key);
  if (res.ok) cachePut(cacheKey, res.data);
  return res;
}

// ---------------------------------------------------------------------------
// Staleness helpers
// ---------------------------------------------------------------------------

/** Board/artifact staleness threshold per platform/PLAN.md: 36 hours. */
export const STALE_AFTER_HOURS = 36;

/**
 * Parse an artifact `generated` stamp to epoch ms. Accepts UTC ISO-8601
 * ("YYYY-MM-DDTHH:MM:SSZ", the contract form) and the legacy tz-less
 * "YYYY-MM-DD HH:MM" (treated as UTC — close enough for a 36h staleness
 * banner). Returns null when unparseable.
 */
export function parseGeneratedMs(generated: string | undefined | null): number | null {
  if (!generated || typeof generated !== "string") return null;
  let s = generated.trim().replace(" ", "T");
  if (!/Z$|[+-]\d{2}:?\d{2}$/.test(s)) s += "Z"; // tz-less legacy stamp -> assume UTC
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

/** Age in hours (1 decimal) since a `generated` stamp; null if unparseable. */
export function ageHours(generated: string | undefined | null): number | null {
  const ms = parseGeneratedMs(generated);
  if (ms == null) return null;
  return Math.round(((Date.now() - ms) / 3_600_000) * 10) / 10;
}
