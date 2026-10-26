import { ogImage, OG_SIZE } from "@/lib/og";
import { PROFILE, SITE } from "@/lib/site";

export const alt = SITE.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: `${PROFILE.name} · ${SITE.name}`, subtitle: PROFILE.role });
}
