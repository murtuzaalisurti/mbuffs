import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge",
};

const WIDTH = 1200;
const HEIGHT = 630;
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1aa";
const APP_NAME = "mbuffs";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

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
  return process.env?.[key];
};

const buildBackendUrl = () => {
  const rawUrl = getEnvVar("VITE_BACKEND_URL");
  if (!rawUrl) {
    return "";
  }
  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
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

const truncate = (value: string, max = 48) => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}...`;
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
    posters: posters.slice(0, 3),
  };
};

const getPosterFrameStyle = (count: number) => {
  if (count <= 1) {
    return { width: 360, height: 540 };
  }

  if (count === 2) {
    return { width: 300, height: 450 };
  }

  return { width: 240, height: 360 };
};

const renderPosterStrip = (posters: string[]) => {
  const count = Math.max(1, Math.min(posters.length, 3));
  const frame = getPosterFrameStyle(count);

  if (posters.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          width: 360,
          height: 540,
          borderRadius: 32,
          background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
          color: MUTED,
          fontSize: 42,
          fontWeight: 600,
        }}
      >
        {APP_NAME}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: count === 3 ? 18 : 28,
      }}
    >
      {posters.map((poster, index) => {
        const rotation =
          count === 3 ? ["-8deg", "0deg", "8deg"][index] : count === 2 ? ["-5deg", "5deg"][index] : "0deg";

        return (
          <div
            key={`${poster}-${index}`}
            style={{
              display: "flex",
              width: frame.width,
              height: frame.height,
              overflow: "hidden",
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
              transform: `rotate(${rotation})`,
              background: "#111827",
            }}
          >
            <img
              src={poster}
              width={frame.width}
              height={frame.height}
              style={{ objectFit: "cover" }}
            />
          </div>
        );
      })}
    </div>
  );
};

const buildFallbackImage = (title: string) => {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
          color: FOREGROUND,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          padding: 48,
        }}
      >
        <div style={{ fontSize: 28, color: MUTED, marginBottom: 20 }}>Collection</div>
        <div style={{ fontSize: 72, fontWeight: 700, textAlign: "center" }}>{truncate(title, 28)}</div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id")?.trim() ?? "";
  const backendUrl = buildBackendUrl();

  if (type !== "collection" || !id || id.length > 60 || !backendUrl) {
    return buildFallbackImage("Collection");
  }

  try {
    const { name, itemCount, posters } = await getCollectionPosters(backendUrl, id);

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "radial-gradient(circle at top left, #27272a 0%, #09090b 58%)",
            color: FOREGROUND,
            padding: 44,
            gap: 36,
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 36,
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: 28,
            }}
          >
            {renderPosterStrip(posters)}
          </div>

          <div
            style={{
              display: "flex",
              width: 360,
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: MUTED, marginBottom: 18 }}>
              Collection
            </div>
            <div
              style={{
                display: "flex",
                fontSize: name.length > 22 ? 50 : 60,
                lineHeight: 1.05,
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              {truncate(name, 48)}
            </div>
            <div style={{ display: "flex", fontSize: 32, color: "#d4d4d8", marginBottom: 28 }}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{APP_NAME}</div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch {
    return buildFallbackImage("Collection");
  }
}
