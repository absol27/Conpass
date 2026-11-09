/* eslint-disable @next/next/no-img-element */

/**
 * Tag, the Conpass mascot (conpass-brand-kit/tag/svg, copied to public/tag). Never redraw Tag; reuse the SVGs.
 * Poses: wave = greeting, point = directions, cheer = success, walk = loading.
 * Faces (wave pose): oops = something went wrong, wink = playful, look = searching, wow, happy.
 */
export type TagPose = "wave" | "point" | "cheer" | "walk" | "oops" | "wink" | "look" | "wow" | "happy" | "welcome";

const FILE: Record<TagPose, string> = {
  wave: "tag-wave",
  // wave pose with a "Conpass / Hello!" badge, generated with make_tag2.tag("wave", ...) for the conference picker
  welcome: "tag-wave-welcome",
  point: "tag-point",
  cheer: "tag-cheer",
  walk: "tag-walk",
  oops: "tag-wave-oops",
  wink: "tag-wave-wink",
  look: "tag-wave-look",
  wow: "tag-wave-wow",
  happy: "tag-wave-happy",
};

export function Tag({ pose = "wave", size = 64, className = "" }: { pose?: TagPose; size?: number; className?: string }) {
  return (
    <img
      src={`/tag/${FILE[pose]}.svg`}
      alt=""
      aria-hidden
      draggable={false}
      width={size}
      height={size}
      className={`shrink-0 select-none ${pose === "walk" ? "tag-bob" : ""} ${className}`}
    />
  );
}
