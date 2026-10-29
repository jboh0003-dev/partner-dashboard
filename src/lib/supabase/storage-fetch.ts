// Keep Storage on its direct Supabase endpoint without replacing Auth or REST.
export function storageFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.protocol === 'https:' && url.hostname === 'mtpnkedvqenddwciazce.supabase.co' && url.pathname.startsWith('/storage/v1/')) {
    url.hostname = 'mtpnkedvqenddwciazce.storage.supabase.co';
    return fetch(input instanceof Request ? new Request(url, input) : url, init);
  }
  return fetch(input, init);
}
