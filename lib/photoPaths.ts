// Thumbnail objects live in the same bucket as the full-res original, named by a
// deterministic suffix off the full path -- no DB column needed to look one up,
// and older captures uploaded before thumbnails existed simply have none (callers
// fall back to the full-res path when a thumb signed-url resolution comes back empty).
export function toThumbPath(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? `${path}-thumb` : `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
}
