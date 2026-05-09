const APP_NAME = "mbuffs";
const DEFAULT_TITLE = "mbuffs";
const DEFAULT_DESCRIPTION = "mbuffs - collaborative movie lists";
const DEFAULT_IMAGE = "https://mbuffs.murtuzaalisurti.com/apple-touch-icon.png";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780";

const getEnvVar = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[key];
};

type OgType = "media" | "person" | "collection";

type OgPayload = {
  title: string;
  description: string;
  image: string;
  ogType: string;
  canonicalPath: string;
};

type ContentResponse = {
  title?: string;
  name?: string;
  overview?: string;
  biography?: string;
  poster_path?: string;
  profile_path?: string;
  release_date?: string;
};

type CollectionResponse = {
  collection?: {
    name?: string;
    description?: string | null;
  };
  movies?: Array<{
    movie_id: string | number;
    is_movie?: boolean | null;
  }>;
};

const buildBackendUrl = () => {
  const rawUrl = getEnvVar("VITE_BACKEND_URL");
  if (!rawUrl) {
    return "";
  }
  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truncate = (value: string, max = 200) => {
  if (!value) return DEFAULT_DESCRIPTION;
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}...`;
};

const extractYear = (date?: string) => {
  if (!date || date.length < 4) return "";
  return date.slice(0, 4);
};

const imageFromPath = (path?: string) => {
  if (!path) return DEFAULT_IMAGE;
  return `${TMDB_IMAGE_BASE}${path}`;
};

const withBrand = (title: string) => `${title} - ${APP_NAME}`;

const fetchJson = async (url: string, init: RequestInit): Promise<unknown> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Upstream request failed with ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchContent = async (backendUrl: string, endpoint: string) => {
  const data = await fetchJson(`${backendUrl}/api/content`, {
    method: "POST",
    body: JSON.stringify({ endpoint }),
  });

  return data as ContentResponse;
};

const fetchCollection = async (backendUrl: string, collectionId: string) => {
  const data = await fetchJson(`${backendUrl}/api/collections/${collectionId}`, {
    method: "GET",
  });

  return data as CollectionResponse;
};

const buildGenericPayload = (pathName: string): OgPayload => ({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  image: DEFAULT_IMAGE,
  ogType: "website",
  canonicalPath: pathName,
});

const getRequestHost = (req: any) => {
  const host = req.headers?.["x-forwarded-host"] ?? req.headers?.host ?? "mbuffs.vercel.app";
  const proto = req.headers?.["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}`;
};

const isNumericId = (value: string) => /^\d+$/.test(value);

const buildOgHtml = (payload: OgPayload, absoluteUrl: string) => {
  const title = escapeHtml(payload.title);
  const description = escapeHtml(payload.description);
  const image = escapeHtml(payload.image);
  const pageUrl = escapeHtml(`${absoluteUrl}${payload.canonicalPath}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="${escapeHtml(payload.ogType)}" />
  <meta property="og:site_name" content="${APP_NAME}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body></body>
</html>`;
};

const buildMediaPayload = async (backendUrl: string, mediaType: string, id: string): Promise<OgPayload> => {
  if ((mediaType !== "movie" && mediaType !== "tv") || !isNumericId(id)) {
    throw new Error("Invalid media route params");
  }

  const content = await fetchContent(backendUrl, `/${mediaType}/${id}`);
  const rawTitle = mediaType === "movie" ? content.title ?? "Movie" : content.name ?? "TV Show";
  const year = mediaType === "movie" ? extractYear(content.release_date) : "";
  const title = year ? `${rawTitle} (${year})` : rawTitle;

  return {
    title: withBrand(title),
    description: truncate(content.overview ?? DEFAULT_DESCRIPTION),
    image: imageFromPath(content.poster_path),
    ogType: mediaType === "movie" ? "video.movie" : "video.tv_show",
    canonicalPath: `/media/${mediaType}/${id}`,
  };
};

const buildPersonPayload = async (backendUrl: string, id: string): Promise<OgPayload> => {
  if (!isNumericId(id)) {
    throw new Error("Invalid person route params");
  }

  const person = await fetchContent(backendUrl, `/person/${id}`);
  const personName = person.name ?? "Person";

  return {
    title: withBrand(personName),
    description: truncate(person.biography ?? DEFAULT_DESCRIPTION),
    image: imageFromPath(person.profile_path),
    ogType: "profile",
    canonicalPath: `/person/${id}`,
  };
};

const buildCollectionPayload = async (backendUrl: string, absoluteUrl: string, id: string): Promise<OgPayload> => {
  const collection = await fetchCollection(backendUrl, id);
  const name = collection.collection?.name ?? "Collection";
  const desc = collection.collection?.description?.trim();
  const itemCount = collection.movies?.length ?? 0;

  return {
    title: withBrand(name),
    description: truncate(desc || `${itemCount} items`),
    image: `${absoluteUrl}/api/og-image?type=collection&id=${encodeURIComponent(id)}`,
    ogType: "website",
    canonicalPath: `/collection/${id}`,
  };
};

const resolvePayload = async (req: any): Promise<OgPayload> => {
  const type = String(req.query?.type ?? "") as OgType;
  const id = String(req.query?.id ?? "").trim();
  const backendUrl = buildBackendUrl();
  const pathName = req.url ? String(req.url).split("?")[0] : "/";
  const absoluteUrl = getRequestHost(req);

  if (!backendUrl) {
    return buildGenericPayload(pathName);
  }

  if (!id || id.length > 60) {
    return buildGenericPayload(pathName);
  }

  if (type === "media") {
    const mediaType = String(req.query?.mediaType ?? "").trim();
    return buildMediaPayload(backendUrl, mediaType, id);
  }

  if (type === "person") {
    return buildPersonPayload(backendUrl, id);
  }

  if (type === "collection") {
    return buildCollectionPayload(backendUrl, absoluteUrl, id);
  }

  return buildGenericPayload(pathName);
};

export default async function handler(req: any, res: any) {
  try {
    const payload = await resolvePayload(req);
    const html = buildOgHtml(payload, getRequestHost(req));

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(html);
  } catch (error) {
    const fallback = buildGenericPayload("/");
    const html = buildOgHtml(fallback, getRequestHost(req));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  }
}
