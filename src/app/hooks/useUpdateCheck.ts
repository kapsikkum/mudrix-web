import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { updateAvailableAtom } from '@/app/store/atoms';
import { fetchDeployedVersion, isNewerVersion, CURRENT_VERSION } from '@/util/versionCheck';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function check(setUpdateAvailable: (v: boolean) => void) {
  const deployed = await fetchDeployedVersion();
  if (deployed && isNewerVersion(CURRENT_VERSION, deployed)) {
    setUpdateAvailable(true);
  }
}

export function useUpdateCheck() {
  const setUpdateAvailable = useSetAtom(updateAvailableAtom);

  useEffect(() => {
    check(setUpdateAvailable);
    const interval = setInterval(() => check(setUpdateAvailable), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [setUpdateAvailable]);
}
