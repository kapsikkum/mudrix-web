import { useState, useEffect } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';

export interface AccountManagementState {
  canChangePassword: boolean;
  canChangeThreePids: boolean;
  accountManagementUrl: string | null;
  loading: boolean;
}

export function useAccountManagement(): AccountManagementState {
  const client = getMatrixClientOrNull();
  const [state, setState] = useState<AccountManagementState>({
    canChangePassword: true,
    canChangeThreePids: true,
    accountManagementUrl: null,
    loading: true,
  });

  useEffect(() => {
    if (!client) return;

    const load = async () => {
      const result: AccountManagementState = {
        canChangePassword: true,
        canChangeThreePids: true,
        accountManagementUrl: null,
        loading: false,
      };

      try {
        const caps = await client.getCapabilities();
        const changePw = caps?.['m.change_password'];
        result.canChangePassword = changePw?.enabled !== false;
        const threePid = caps?.['m.3pid_changes'];
        result.canChangeThreePids = threePid?.enabled !== false;
      } catch {
        // assume password change is available by default
      }

      try {
        const meta = await client.getAuthMetadata();
        result.accountManagementUrl = meta.account_management_uri ?? null;
      } catch {
        // ignore
      }

      setState(result);
    };

    load();
  }, [client]);

  return state;
}
