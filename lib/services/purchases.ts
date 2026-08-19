import Purchases, { type PurchasesPackage } from "react-native-purchases";

import { reportError } from "./sentry";
import { supabase } from "./supabase";

/**
 * RevenueCat SDK wrapper (Phase 3a). FAIL-SAFE like Sentry/Google sign-in: with no
 * EXPO_PUBLIC_REVENUECAT_ANDROID_KEY set, every export here is a safe no-op, so a
 * build without the key runs identically (no crash, purchases section just never
 * shows anything buyable).
 *
 * The client NEVER writes frame ownership itself — every purchase/restore here
 * calls the revenuecat-sync edge function, which is the only thing allowed to grant
 * ownership (via grant_purchase(), server-side). This file only talks to the store
 * and to that one endpoint.
 */

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const purchasesEnabled = API_KEY !== undefined && API_KEY !== "";

let configured = false;

/** Ties the RevenueCat subscriber to the signed-in Supabase account. Call on every
 *  sign-in (cold launch and live SIGNED_IN) — cheap to call again if already
 *  configured for the same user (logIn is idempotent). */
export function configurePurchases(uid: string): void {
  if (!API_KEY) return;
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY, appUserID: uid });
    configured = true;
  } else {
    void Purchases.logIn(uid).catch((e) => reportError(e, { flow: "configure_purchases_login" }));
  }
}

/** Drop the RevenueCat identity on sign-out, so a shared device's next account
 *  isn't attributed the previous user's purchases. */
export function logOutPurchases(): void {
  if (!API_KEY || !configured) return;
  void Purchases.logOut().catch((e) => reportError(e, { flow: "logout_purchases" }));
}

/** All packages in the current offering, keyed by the underlying store product id
 *  (matches frames.product_id) so callers never need RevenueCat's own package
 *  identifiers. */
export async function getFramePackages(): Promise<Map<string, PurchasesPackage>> {
  if (!API_KEY) return new Map();
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return new Map(pkgs.map((p) => [p.product.identifier, p]));
}

export type PurchaseResult = { ok: true } | { ok: false; reason: "cancelled" | "error" };

/** Buys the package whose store product id matches productId, then reconciles via
 *  revenuecat-sync so the frame is owned (server-verified) before this resolves. */
export async function purchaseFrameProduct(productId: string): Promise<PurchaseResult> {
  if (!API_KEY) return { ok: false, reason: "error" };
  try {
    const packages = await getFramePackages();
    const pkg = packages.get(productId);
    if (!pkg) return { ok: false, reason: "error" };
    await Purchases.purchasePackage(pkg);
    const synced = await syncPurchases();
    // The HTTP call succeeding isn't enough — if the sync ran but didn't recognize
    // this product (grant_purchase returned unknown_product/unknown_user), nothing
    // was actually granted, and that's a purchase failure from the user's point of
    // view even though no exception was thrown anywhere.
    if (!synced || synced.unknown?.length) {
      reportError(new Error("revenuecat_sync did not confirm the purchase"), {
        flow: "purchase_frame_sync",
        productId,
        unknown: synced?.unknown,
      });
      return { ok: false, reason: "error" };
    }
    return { ok: true };
  } catch (e) {
    const err = e as { userCancelled?: boolean };
    if (err.userCancelled) return { ok: false, reason: "cancelled" };
    reportError(e, { flow: "purchase_frame", productId });
    return { ok: false, reason: "error" };
  }
}

/** Restore Purchases button handler — restores from the store, then reconciles via
 *  revenuecat-sync (doesn't rely on webhook timing for this store-required flow). */
export async function restoreAndSyncPurchases(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    await Purchases.restorePurchases();
    const synced = await syncPurchases();
    return synced?.ok === true;
  } catch (e) {
    reportError(e, { flow: "restore_purchases" });
    return false;
  }
}

type SyncResponse = { ok: boolean; granted?: string[]; failed?: string[]; unknown?: string[] };

/** Calls revenuecat-sync and returns its parsed response, or null if the HTTP call
 *  itself failed. `ok: true` only means the sync ran — callers that care whether a
 *  *specific* product was actually granted must also check `unknown` (a product id
 *  the sync ran for but grant_purchase didn't recognize, i.e. still not owned). */
async function syncPurchases(): Promise<SyncResponse | null> {
  const { data, error } = await supabase.functions.invoke("revenuecat-sync");
  if (error) {
    reportError(error, { flow: "revenuecat_sync" });
    return null;
  }
  const body = data as SyncResponse | null;
  return body?.ok === true ? body : null;
}
