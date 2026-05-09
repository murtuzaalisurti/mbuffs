/// <reference types="node" />

import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1aa";
const APP_NAME = "mbuffs";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
const PANEL = { left: 44, top: 44, width: 716, height: 542 };

type CollectionResponse = {
  collection?: {
    name?: string;
  };
  movies?: Array<{
    movie_id: string | number;
    is_movie?: boolean | null;
  }>;
};

type ContentResponse = {
  poster_path?: string;
};


const getEnvVar = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[key];
};

const buildBackendUrl = () => {
  const rawUrl = getEnvVar("VITE_BACKEND_URL");
  if (!rawUrl) {
    return "";
  }
  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truncate = (value: string, max = 48) => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}...`;
};

const isNumericId = (value: string) => /^\d+$/.test(value);

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

const fetchCollection = async (backendUrl: string, collectionId: string) => {
  const data = await fetchJson(`${backendUrl}/api/collections/${collectionId}`, {
    method: "GET",
  });

  return data as CollectionResponse;
};

const fetchContent = async (backendUrl: string, endpoint: string) => {
  const data = await fetchJson(`${backendUrl}/api/content`, {
    method: "POST",
    body: JSON.stringify({ endpoint }),
  });

  return data as ContentResponse;
};

const imageFromPath = (path?: string) => {
  if (!path) {
    return "";
  }
  return `${TMDB_IMAGE_BASE}${path}`;
};

const fetchImageBytes = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image request failed with ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeoutId);
  }
};

const getCollectionPosters = async (backendUrl: string, collectionId: string) => {
  const collection = await fetchCollection(backendUrl, collectionId);
  const items = (collection.movies ?? [])
    .filter((item) => isNumericId(String(item.movie_id)))
    .slice(0, 6);

  const posters = (await Promise.all(
    items.map(async (item) => {
      try {
        const endpoint = item.is_movie === false ? `/tv/${item.movie_id}` : `/movie/${item.movie_id}`;
        const content = await fetchContent(backendUrl, endpoint);
        const poster = imageFromPath(content.poster_path);
        return poster || null;
      } catch {
        return null;
      }
    })
  )).filter(Boolean) as string[];

  return {
    name: collection.collection?.name?.trim() || "Collection",
    itemCount: collection.movies?.length ?? 0,
    posters: posters.slice(0, 4),
  };
};


const svgBytes = (svg: string) => Buffer.from(svg);

const buildBackdropSvg = (name: string, itemCount: number) => {
  const fontSize = name.length > 22 ? 50 : 60;
  const safeName = escapeXml(truncate(name, 40));
  const safeCount = escapeXml(`${itemCount} item${itemCount === 1 ? "" : "s"}`);

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(120 40) rotate(35) scale(980 760)">
          <stop offset="0" stop-color="#27272a" />
          <stop offset="1" stop-color="#09090b" />
        </radialGradient>
        <linearGradient id="panel" x1="44" y1="44" x2="760" y2="586" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
      <rect x="${PANEL.left}" y="${PANEL.top}" width="${PANEL.width}" height="${PANEL.height}" rx="36" fill="url(#panel)" stroke="#ffffff" stroke-opacity="0.06" />
      <text x="800" y="224" fill="${MUTED}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500">Collection</text>
      <text x="800" y="326" fill="${FOREGROUND}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700">${safeName}</text>
      <text x="800" y="390" fill="#d4d4d8" font-family="Arial, Helvetica, sans-serif" font-size="32">${safeCount}</text>
      <text x="800" y="458" fill="${MUTED}" font-family="Arial, Helvetica, sans-serif" font-size="24">${APP_NAME}</text>
    </svg>
  `;
};

const roundedMask = (width: number, height: number, radius: number) => svgBytes(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff" />
  </svg>
`);


const buildFallbackImage = async (title: string) => {
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: "#09090b",
    },
  })
    .composite([
      {
        input: svgBytes(`
          <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#18181b" />
                <stop offset="1" stop-color="#09090b" />
              </linearGradient>
            </defs>
            <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
            <text x="600" y="250" text-anchor="middle" fill="${MUTED}" font-family="Arial, Helvetica, sans-serif" font-size="28">Collection</text>
            <text x="600" y="340" text-anchor="middle" fill="${FOREGROUND}" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700">${escapeXml(truncate(title, 24))}</text>
          </svg>
        `),
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
};

const buildCollectionImage = async (name: string, itemCount: number, posters: string[]) => {
  const gap = 4;
  const radius = 24;
  const count = posters.length;

  type TileSpec = { x: number; y: number; w: number; h: number };
  let tiles: TileSpec[];

  if (count <= 1) {
    tiles = [{ x: 0, y: 0, w: PANEL.width, h: PANEL.height }];
  } else if (count === 2) {
    const w = Math.floor((PANEL.width - gap) / 2);
    tiles = [
      { x: 0, y: 0, w, h: PANEL.height },
      { x: w + gap, y: 0, w: PANEL.width - w - gap, h: PANEL.height },
    ];
  } else if (count === 3) {
    const w = Math.floor((PANEL.width - gap) / 2);
    const h = Math.floor((PANEL.height - gap) / 2);
    tiles = [
      { x: 0, y: 0, w, h: PANEL.height },
      { x: w + gap, y: 0, w: PANEL.width - w - gap, h },
      { x: w + gap, y: h + gap, w: PANEL.width - w - gap, h: PANEL.height - h - gap },
    ];
  } else {
    const w = Math.floor((PANEL.width - gap) / 2);
    const h = Math.floor((PANEL.height - gap) / 2);
    tiles = [
      { x: 0, y: 0, w, h },
      { x: w + gap, y: 0, w: PANEL.width - w - gap, h },
      { x: 0, y: h + gap, w, h: PANEL.height - h - gap },
      { x: w + gap, y: h + gap, w: PANEL.width - w - gap, h: PANEL.height - h - gap },
    ];
  }

  const tileComposites: sharp.OverlayOptions[] = [];
  for (const [i, posterUrl] of posters.entries()) {
    const tile = tiles[i];
    if (!tile) break;
    const source = await fetchImageBytes(posterUrl);
    const resized = await sharp(source)
      .resize(tile.w, tile.h, { fit: "cover" })
      .png()
      .toBuffer();
    tileComposites.push({ input: resized, left: tile.x, top: tile.y });
  }

  let collage = await sharp({
    create: {
      width: PANEL.width,
      height: PANEL.height,
      channels: 4,
      background: { r: 24, g: 24, b: 27, alpha: 255 },
    },
  })
    .composite(tileComposites)
    .png()
    .toBuffer();

  collage = await sharp(collage)
    .composite([{ input: roundedMask(PANEL.width, PANEL.height, radius), blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: "#09090b",
    },
  })
    .composite([
      { input: svgBytes(buildBackdropSvg(name, itemCount)), left: 0, top: 0 },
      { input: collage, left: PANEL.left, top: PANEL.top },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
};

export default async function handler(req: any, res: any) {
  const type = String(req.query?.type ?? "").trim();
  const id = String(req.query?.id ?? "").trim();
  const backendUrl = buildBackendUrl();

  try {
    let image: Uint8Array;

    if (type === "collection" && id && id.length <= 60 && backendUrl) {
      const { name, itemCount, posters } = await getCollectionPosters(backendUrl, id);
      image = await buildCollectionImage(name, itemCount, posters);
    } else {
      image = await buildFallbackImage("Collection");
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", String(image.byteLength));
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(image);
  } catch {
    const image = await buildFallbackImage("Collection");
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", String(image.byteLength));
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(image);
  }
}
