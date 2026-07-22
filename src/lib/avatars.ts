/**
 * Student avatar assignment.
 * Maps student initials consistently to one of 15 monster avatars.
 * Uses a simple hash of the initials to pick an avatar, so the
 * same student always gets the same avatar.
 */

const AVATAR_COUNT = 15;

export function getAvatarUrl(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COUNT;
  // 1-indexed filenames
  const num = String(index + 1).padStart(2, "0");
  return `/avatars/monster-${num}.png`;
}

/**
 * Returns a deterministic background color for use as a fallback
 * while the avatar image loads, or when avatars are not available.
 */
const FALLBACK_COLORS = [
  "#3B6FB6", "#4CAF82", "#D4893A", "#7B5BA8", "#E0705E",
  "#5A8ECF", "#5A8A3C", "#C48A30", "#6B3A6B", "#8A3A3A",
];

export function avatarFallbackColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
