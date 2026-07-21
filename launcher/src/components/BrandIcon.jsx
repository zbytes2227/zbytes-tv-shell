import React, { useState } from "react";
import * as LucideIcons from "lucide-react";

/**
 * BrandIcon — real brand logos for all launcher apps.
 *
 * Resolution chain:
 *   1. Simple Icons CDN  (https://simpleicons.org) — SVG, served in white
 *      so it reads clearly over the app card's colored tint background.
 *   2. Lucide fallback   — if CDN fails (network error, unknown slug).
 *
 * Why Simple Icons?
 *  - Open-source, actively maintained (~3 000 icons)
 *  - CDN delivers sub-5 kB SVG per icon
 *  - Single color format lets us tint to white for the dark UI
 *  - No npm install required
 */

const CDN = "https://cdn.simpleicons.org";

// Map app IDs (from backend/apps.json) → Simple Icons slug.
// null = no Simple Icons entry; will fall through to Lucide.
const SLUG_MAP = {
  youtube:    "youtube",
  netflix:    "netflix",
  jiohotstar: "hotstar",       // JioHotstar uses the Hotstar icon
  gmeet:      "googlemeet",
  primevideo: "primevideo",
  sonyliv:    "sonyliv",
  zee5:       "zee5",
  mxplayer:   "mxplayer",
  spotify:    "spotify",
  gaana:      "gaana",
  jiosaavn:   "jiosaavn",
  instagram:  "instagram",
  facebook:   "facebook",
  x:          "x",
  reddit:     "reddit",
  gmail:      "gmail",
  drive:      "googledrive",
  photos:     "googlephotos",
  maps:       "googlemaps",
  weather:    null,            // no widely-recognised weather brand icon
  browser:    "googlechrome",
};

export default function BrandIcon({ app, size = 52 }) {
  const [failed, setFailed] = useState(false);

  const slug = SLUG_MAP[app.id];

  // ── Lucide fallback ────────────────────────────────────────────
  // Triggered by: no slug in map, or CDN image load error.
  if (!slug || failed) {
    const LucideIcon = LucideIcons[app.icon] || LucideIcons.AppWindow;
    return (
      <LucideIcon
        size={size}
        strokeWidth={1.75}
        className="app-card__icon"
        aria-hidden="true"
      />
    );
  }

  // ── Simple Icons CDN ───────────────────────────────────────────
  // /ffffff renders the icon in white — crisp on tinted dark containers.
  return (
    <img
      src={`${CDN}/${slug}/ffffff`}
      width={size}
      height={size}
      className="app-card__icon app-card__icon--brand"
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
