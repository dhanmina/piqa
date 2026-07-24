import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchKey } from "../cache";
import { useSession } from "../session";
import { BOOTSTRAP, DEFAULT_FRAME_DEF, fetchCatalog, frameForDate, type FrameDef, type FrameId } from "../services/frames";

const FrameCatalogContext = createContext<Map<FrameId, FrameDef>>(BOOTSTRAP);

export function FrameCatalogProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [catalog, setCatalog] = useState<Map<FrameId, FrameDef>>(BOOTSTRAP);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    void fetchKey("frames:catalog", fetchCatalog)
      .then((m) => {
        if (alive) setCatalog(m);
      })
      .catch(() => {
        /* keep the bootstrap catalog; default still renders every photo */
      });
    return () => {
      alive = false;
    };
  }, [session]);

  return <FrameCatalogContext.Provider value={catalog}>{children}</FrameCatalogContext.Provider>;
}

export function useFrameCatalog(): Map<FrameId, FrameDef> {
  return useContext(FrameCatalogContext);
}

export function useFrameDef(id: FrameId): FrameDef {
  const catalog = useFrameCatalog();
  return catalog.get(id) ?? catalog.get("default") ?? DEFAULT_FRAME_DEF;
}

export function useFrameForDate(dateISO: string | null | undefined): FrameId {
  return frameForDate(useFrameCatalog(), dateISO);
}
