/**
 * Reads at most the first `limit` bytes of a resource. Asks the server for just that range, and
 * if it ignores the Range header (answers 200 with the whole body) reads the stream only as far
 * as needed and cancels the rest. Returns null when the request fails.
 */
export async function fetchHead(
  url: string,
  limit: number,
  options: { token?: string | null; signal?: AbortSignal } = {}
): Promise<Uint8Array | null> {
  const { token, signal } = options;
  const headers: Record<string, string> = { Range: `bytes=0-${limit - 1}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { headers, signal });
    // 416: the range starts past the end, i.e. the file is empty.
    if (res.status === 416) return new Uint8Array(0);
    if (!res.ok) return null;
    if (!res.body) {
      return new Uint8Array(await res.arrayBuffer()).slice(0, limit);
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    if (total >= limit) void reader.cancel().catch(() => {});
    const out = new Uint8Array(Math.min(total, limit));
    let offset = 0;
    for (const chunk of chunks) {
      if (offset >= out.length) break;
      const part =
        chunk.length > out.length - offset ? chunk.subarray(0, out.length - offset) : chunk;
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  } catch {
    return null;
  }
}
