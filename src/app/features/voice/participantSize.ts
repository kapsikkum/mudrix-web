export const PARTICIPANT_ROW_HEIGHT = 26;
export const PARTICIPANT_ROW_GAP = 1;
export const PARTICIPANT_WRAP_PADDING_V = 5;

export function computeParticipantsBlockHeight(count: number): number {
  if (count <= 0) return 0;
  return (
    PARTICIPANT_WRAP_PADDING_V +
    count * PARTICIPANT_ROW_HEIGHT +
    Math.max(0, count - 1) * PARTICIPANT_ROW_GAP
  );
}
