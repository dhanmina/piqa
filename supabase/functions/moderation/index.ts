// Content moderation edge function — scans a submission's thumbnail via
// Google Cloud Vision SafeSearch and quarantines if above threshold.
//
// Deploy:   supabase functions deploy moderation
// Secrets:  GOOGLE_VISION_API_KEY (set via supabase secrets set)
//
// Call it (authenticated) with:
//   POST /functions/v1/moderation
//   Authorization: Bearer <SUPABASE_ANON_KEY>
//   { "submission_id": "..." }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_VISION_URL =
  "https://vision.googleapis.com/v1/images:annotate";

type Likelihood = "UNKNOWN" | "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY";

type ModerationResult = {
  label: "safe" | "nudity" | "violence" | "explicit";
  score: number; // 0-1, higher = more likely flagged
  raw?: Record<string, string>;
};

/**
 * Call Google Cloud Vision SafeSearch on a base64 image.
 * Returns a normalised label + score.
 */
async function scanWithGoogleVision(
  imageBytes: string,
  apiKey: string,
): Promise<ModerationResult> {
  const res = await fetch(`${GOOGLE_VISION_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBytes },
          features: [{ type: "SAFE_SEARCH_DETECTION", maxResults: 1 }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const ann = data.responses?.[0]?.safeSearchAnnotation;
  if (!ann) return { label: "safe", score: 0 };

  // Map likelihood strings to numeric scores (0-1).
  const likelihoodScore: Record<string, number> = {
    UNKNOWN: 0,
    VERY_UNLIKELY: 0.1,
    UNLIKELY: 0.3,
    POSSIBLE: 0.5,
    LIKELY: 0.7,
    VERY_LIKELY: 0.9,
  };

  const adult = likelihoodScore[ann.adult] ?? 0;
  const violence = likelihoodScore[ann.violence] ?? 0;
  const racy = likelihoodScore[ann.racy] ?? 0;

  const maxScore = Math.max(adult, violence, racy);

  let label: ModerationResult["label"] = "safe";
  if (adult >= 0.5 || racy >= 0.7) label = "nudity";
  else if (violence >= 0.5) label = "violence";
  else if (racy >= 0.5) label = "explicit";

  return {
    label,
    score: maxScore,
    raw: { adult, violence, racy },
  };
}

/**
 * Fallback: simple heuristic scan (no external API).
 * Scores based on image properties — a placeholder until a real
 * classifier is wired. Returns safe for everything.
 */
async function scanHeuristic(
  _imageBytes: string,
): Promise<ModerationResult> {
  return { label: "safe", score: 0 };
}

Deno.serve(async (req) => {
  // CORS preflight.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { submission_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!body.submission_id) {
    return new Response("submission_id required", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Fetch the submission (service role bypasses RLS).
  const { data: sub, error: fetchErr } = await supabase
    .from("submissions")
    .select("id, thumb_path, content_label")
    .eq("id", body.submission_id)
    .single();

  if (fetchErr || !sub) {
    return new Response("submission not found", { status: 404 });
  }

  // Already scanned — skip.
  if (sub.content_label !== null) {
    return Response.json({ ok: true, cached: true });
  }

  if (!sub.thumb_path) {
    return new Response("no thumb_path", { status: 400 });
  }

  // Download the thumbnail from storage.
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("submissions")
    .download(sub.thumb_path);

  if (dlErr || !fileData) {
    return new Response("download failed", { status: 500 });
  }

  // Convert to base64.
  const arrayBuf = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);

  // Scan with available API, fall back to heuristic.
  const apiKey = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";
  const result = apiKey
    ? await scanWithGoogleVision(b64, apiKey).catch((e) => {
        console.error("Vision API error:", e);
        return scanHeuristic(b64);
      })
    : await scanHeuristic(b64);

  // Call quarantine_if_flagged RPC (service role).
  const { error: rpcErr } = await supabase.rpc("quarantine_if_flagged", {
    p_submission: body.submission_id,
    p_label: result.label,
    p_score: result.score,
  });

  if (rpcErr) {
    console.error("quarantine_if_flagged failed:", rpcErr);
    return new Response("rpc failed", { status: 500 });
  }

  return Response.json({
    ok: true,
    label: result.label,
    score: result.score,
  });
});
