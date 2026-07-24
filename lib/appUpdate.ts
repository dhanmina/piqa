import * as Application from "expo-application";
import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";

import { getConfig } from "./services/config";

const PACKAGE = "com.joinpiqa.app";
const MARKET_URL = `market://details?id=${PACKAGE}`;
const WEB_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}`;

export type UpdateStatus = "none" | "soft" | "forced";

/** Installed Android build number (versionCode). 0 when unknown (dev/web/iOS). */
function installedBuild(): number {
  const raw = Application.nativeBuildVersion; // Android: versionCode as a string
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Nudge users onto a newer Play Store build. Pure JS, so it ships over OTA: it
 * compares the installed versionCode against `latest_build` (soft nudge) and
 * `min_build` (forced) from the config table. Bump `latest_build` in config the
 * moment a new build is live on Play and everyone below it sees the prompt.
 *
 * Android only — iOS and web have no Play target here, and a 0/unknown installed
 * build never nags. `enabled` gates on having a session (config reads are RLS'd
 * to authenticated users).
 */
export function useAppUpdate(enabled: boolean): { status: UpdateStatus; openStore: () => void } {
  const [status, setStatus] = useState<UpdateStatus>("none");

  useEffect(() => {
    if (!enabled || Platform.OS !== "android") return;
    let alive = true;
    void (async () => {
      const installed = installedBuild();
      if (installed <= 0) return; // unknown build -> never prompt
      const latest = Number(await getConfig("latest_build")) || 0;
      const min = Number(await getConfig("min_build")) || 0;
      if (!alive) return;
      if (installed < min) setStatus("forced");
      else if (installed < latest) setStatus("soft");
      else setStatus("none");
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  const openStore = () => {
    // Prefer the Play app; fall back to the web listing.
    void Linking.openURL(MARKET_URL).catch(() => Linking.openURL(WEB_URL).catch(() => {}));
  };

  return { status, openStore };
}
