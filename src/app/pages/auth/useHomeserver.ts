import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeUrl } from '@/client/initMatrix';
import {
  discoverAuthCapabilities,
  DiscoveryStatus,
  type AuthCapabilities,
} from '@/app/features/sso/sso';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { STORAGE_KEY_LAST_HOMESERVER } from '@/const/storageKeys';
import { displayHost, hostOf, isCompleteAddress } from './authInput';

/** Pause after the last keystroke before an address typed by hand is checked. */
const TYPING_DEBOUNCE_MS = 500;
const OK_TTL_MS = 5 * 60_000;
const FAIL_TTL_MS = 15_000;

export interface Homeserver {
  /** What is in the address box. */
  input: string;
  /** The address as a URL (`https://matrix.org`), '' when the box is empty. */
  url: string;
  /** The address as people write it (`matrix.org`). */
  host: string;
  /** The address is complete enough to check (`matrix.o` is not). */
  complete: boolean;
  /** The newest answer that arrived; it may be for an earlier address while a new check runs. */
  result: { url: string; caps: AuthCapabilities } | null;
  /** The answer for the address in the box, once it is in. */
  current: AuthCapabilities | null;
  /** A check for the address in the box is waiting or running. */
  checking: boolean;
  /**
   * The last server that answered as a homeserver. Which sign-in methods the forms offer follows
   * this, so the form does not rearrange itself for every half-typed address.
   */
  methods: AuthCapabilities | null;
  /** The address `methods` came from, as people write it. */
  methodsHost: string;
  /** Something answered for this address and it is not a usable homeserver. */
  notAServer: boolean;
  /** The URL to talk to: the resolved client URL when known, the address otherwise. */
  baseUrl: string;
  /** The server part of user ids here (`matrix.org`), as well as it is known. */
  serverName: string;
  setInput: (value: string, opts?: { now?: boolean }) => void;
  /** Checks the address again, ignoring any remembered answer. */
  retry: () => void;
  /** The answer for the address in the box, checking now if it is not in yet. */
  ensure: () => Promise<AuthCapabilities | null>;
}

export function rememberHomeserver(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_HOMESERVER, displayHost(url));
  } catch {
    // storage full or blocked: the default is fine
  }
}

/** Where the address box starts: the configured server, the last one used, or the default. */
export function initialHomeserver(configured?: string): string {
  if (configured) return displayHost(configured);
  try {
    const last = localStorage.getItem(STORAGE_KEY_LAST_HOMESERVER);
    if (last) return last;
  } catch {
    // ignore
  }
  return displayHost(PRESET_SERVERS[0].value);
}

export function useHomeserver(initial: string): Homeserver {
  const [input, setInputState] = useState(initial);
  const [result, setResult] = useState<Homeserver['result']>(null);
  const [methods, setMethods] = useState<{ url: string; caps: AuthCapabilities } | null>(null);
  const [inFlight, setInFlight] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const cache = useRef(new Map<string, { at: number; promise: Promise<AuthCapabilities> }>());
  const seq = useRef(0);
  const checkNow = useRef(true);

  const url = normalizeUrl(input);
  const complete = isCompleteAddress(input);

  const lookup = useCallback((target: string, force: boolean) => {
    const hit = cache.current.get(target);
    if (hit && !force) return hit.promise;
    const promise = discoverAuthCapabilities(target);
    const entry = { at: Date.now(), promise };
    cache.current.set(target, entry);
    void promise.then((caps) => {
      const ttl = caps.discoveryStatus === DiscoveryStatus.Ok ? OK_TTL_MS : FAIL_TTL_MS;
      setTimeout(() => {
        if (cache.current.get(target) === entry) cache.current.delete(target);
      }, ttl);
    });
    return promise;
  }, []);

  const run = useCallback(
    async (target: string, force = false) => {
      const mine = ++seq.current;
      setWaiting(false);
      setInFlight(target);
      const caps = await lookup(target, force);
      if (mine === seq.current) {
        setResult({ url: target, caps });
        if (caps.discoveryStatus === DiscoveryStatus.Ok) setMethods({ url: target, caps });
        setInFlight(null);
      }
      return caps;
    },
    [lookup]
  );

  useEffect(() => {
    const now = checkNow.current;
    checkNow.current = false;
    if (!complete) {
      // Nothing worth asking about yet; whatever was shown stays until there is.
      seq.current++;
      setWaiting(false);
      setInFlight(null);
      return undefined;
    }
    // A remembered answer (typing back to an address checked a moment ago) shows at once.
    const known = cache.current.has(url);
    if (!known) setWaiting(true);
    const timer = setTimeout(() => void run(url), now || known ? 0 : TYPING_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url, complete, run]);

  const setInput = useCallback((value: string, opts?: { now?: boolean }) => {
    checkNow.current = !!opts?.now;
    setInputState(value);
  }, []);

  const current = result && result.url === url && complete ? result.caps : null;

  const ensure = useCallback(async () => {
    if (current && !inFlight) return current;
    if (!complete) return null;
    return run(url);
  }, [current, inFlight, complete, url, run]);

  const retry = useCallback(() => {
    if (complete) void run(url, true);
  }, [complete, url, run]);

  return useMemo(
    () => ({
      input,
      url,
      host: displayHost(input),
      complete,
      result,
      current,
      checking: complete && (waiting || inFlight === url),
      methods: methods?.caps ?? null,
      methodsHost: methods ? displayHost(methods.url) : displayHost(input),
      notAServer: !!current && current.discoveryStatus !== DiscoveryStatus.Ok,
      baseUrl: current?.resolvedBaseUrl ?? url,
      serverName: current?.serverName ?? hostOf(url),
      setInput,
      retry,
      ensure,
    }),
    [input, url, complete, result, current, waiting, inFlight, methods, setInput, retry, ensure]
  );
}
