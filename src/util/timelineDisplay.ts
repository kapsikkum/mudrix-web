import type { MatrixEvent } from 'matrix-js-sdk';

export interface ProfileChange {
  name: { from: string; to: string } | null;
  avatar: 'changed' | 'removed' | null;
}

/** Describes a join->join member event that only changed display name and/or avatar. */
export function getProfileChange(event: MatrixEvent): ProfileChange | null {
  if (event.getType() !== 'm.room.member') return null;
  const content = event.getContent();
  const prev = event.getPrevContent();
  if (content?.membership !== 'join' || prev?.membership !== 'join') return null;
  const nameChanged = (content.displayname ?? '') !== (prev.displayname ?? '');
  const newAvatar = (content.avatar_url ?? '') as string;
  const avatarChanged = newAvatar !== ((prev.avatar_url ?? '') as string);
  if (!nameChanged && !avatarChanged) return null;
  return {
    name: nameChanged
      ? { from: (prev.displayname ?? '') as string, to: (content.displayname ?? '') as string }
      : null,
    avatar: avatarChanged ? (newAvatar ? 'changed' : 'removed') : null,
  };
}

// Timeline filtering preferences, kept at module level (set from the settings atoms in App)
// because event-rendering predicates are plain functions used outside React as well.
let hideMembershipEvents = false;
let hideProfileEvents = true;

export function setTimelineDisplayPrefs(prefs: {
  hideMembershipEvents: boolean;
  hideProfileEvents: boolean;
}): void {
  hideMembershipEvents = prefs.hideMembershipEvents;
  hideProfileEvents = prefs.hideProfileEvents;
}

export function shouldHideMembershipEvents(): boolean {
  return hideMembershipEvents;
}

export function shouldHideProfileEvents(): boolean {
  return hideProfileEvents;
}
