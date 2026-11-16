import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { updateAvailableAtom } from '@/app/store/atoms';
import { isTauriDesktop } from '@/util/desktop';
import { fetchDeployedVersion, isNewerVersion, CURRENT_VERSION } from '@/util/versionCheck';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useUpdateCheck() {
  const setUpdateAvailable = useSetAtom(updateAvailableAtom);

  const query = useQuery({
    queryKey: ['deployed-version'],
    queryFn: fetchDeployedVersion,
    // The desktop shell has its own native updater (old apps use it too); this check is for the
    // hosted web client, which has no other way to learn that a newer build was deployed.
    enabled: !isTauriDesktop(),
    refetchInterval: CHECK_INTERVAL_MS,
    staleTime: CHECK_INTERVAL_MS,
    select: (deployed) => {
      if (deployed && isNewerVersion(CURRENT_VERSION, deployed)) return true;
      return false;
    },
  });

  useEffect(() => {
    if (query.data) {
      setUpdateAvailable(true);
    }
  }, [query.data, setUpdateAvailable]);
}
