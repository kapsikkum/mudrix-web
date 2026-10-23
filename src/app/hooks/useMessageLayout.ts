import { useAtomValue } from 'jotai';
import { messageLayoutAtom, messageLayoutMobileAtom } from '@/app/store/atoms/settings';
import { isMobileDevice } from '@/util/desktop';
import type { MessageLayout } from '@/app/store/atoms/settings';

const MOBILE = isMobileDevice();

/** The message layout in effect on this device: phones use their own setting, others the main one. */
export function useMessageLayout(): MessageLayout {
  const main = useAtomValue(messageLayoutAtom);
  const mobile = useAtomValue(messageLayoutMobileAtom);
  return MOBILE ? (mobile ?? main) : main;
}
