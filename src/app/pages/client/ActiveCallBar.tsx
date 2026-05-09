import { InCallControls } from '@/app/features/calls/InCallControls';
import type { CallState } from '@/app/store/atoms/call';

interface ActiveCallBarProps {
  callState: CallState;
  onHangup: () => void;
  onToggleMute: () => void;
}

export function ActiveCallBar({ callState, onHangup, onToggleMute }: ActiveCallBarProps) {
  return <InCallControls callState={callState} onHangup={onHangup} onToggleMute={onToggleMute} />;
}
