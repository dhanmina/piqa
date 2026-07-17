import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { supabase } from "./supabase";

/**
 * The payload every piqa push carries. `type` decides where a tap lands; the ids
 * deep-link to a specific shot/person. Kept in sync with the server sender.
 */
export type PushData = {
  type?: "drop" | "reveal" | "gallery" | "result" | "potd" | "follow" | "streak";
  photoId?: string;
  userId?: string;
};

/**
 * FCM drop / reveal push (spec §14). This is the on-device half: request
 * permission, register an Expo push token, and store it on the profile. The
 * server-side fan-out (drop_prompt → Expo Push API, jittered 10–15 min) is
 * launch-prep infra. The app must work fully WITHOUT push (spec §14), so every
 * failure here degrades silently — the token is a bonus, never a gate.
 *
 * A real token needs the EAS projectId configured (`eas init`); until then this
 * requests permission + sets up the Android channel but skips token generation.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false, // no sound effects, ever (spec §11b)
    shouldSetBadge: false,
  }),
});

export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Piqa",
        importance: Notifications.AndroidImportance.HIGH, // high-priority (OEMs kill low)
        vibrationPattern: [0, 120],
        lightColor: "#FF5A36",
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
    if (!projectId) {
      if (__DEV__) console.log("[push] no EAS projectId yet — permission set, token skipped (run `eas init` to enable FCM)");
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (uid && token) {
      await supabase.from("profiles").update({ push_token: token }).eq("id", uid);
      if (__DEV__) console.log("[push] registered token for", uid);
    }
  } catch (e) {
    if (__DEV__) console.log("[push] registration skipped:", e);
  }
}

/**
 * Route a tapped notification to the right screen — both when the app is already
 * running (listener) and when a tap cold-starts it (getLastNotificationResponse).
 * Mount once, high in the tree. A tap with no/unknown type is a no-op (the OS
 * still foregrounds the app to Today).
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  useEffect(() => {
    const go = (raw: unknown) => {
      const data = (raw ?? {}) as PushData;
      switch (data.type) {
        case "drop":
        case "streak":
        case "result":
          router.push("/(tabs)/today");
          break;
        case "reveal":
        case "gallery":
          router.push("/(tabs)/gallery");
          break;
        case "potd":
          if (data.photoId) router.push({ pathname: "/photo/[id]", params: { id: data.photoId } });
          else router.push("/(tabs)/gallery");
          break;
        case "follow":
          if (data.userId) router.push({ pathname: "/u/[id]", params: { id: data.userId } });
          break;
      }
    };
    // Cold start: the app was opened by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) go(r.notification.request.content.data);
    });
    // Warm: tapped while the app is running or backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((r) => go(r.notification.request.content.data));
    return () => sub.remove();
  }, [router]);
}
