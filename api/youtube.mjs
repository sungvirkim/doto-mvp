export function showcaseVideo(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const link = value.trim();
  if (!link) return null;
  let url;
  try {
    url = new URL(/^(?:https?:)?\/\//i.test(link) ? link : 'https://' + link);
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname;
  let id;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).replace(/\/$/, '');
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') :
      url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)\/?$/)?.[1];
  }
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  return { id, url: 'https://www.youtube.com/watch?v=' + id };
}
