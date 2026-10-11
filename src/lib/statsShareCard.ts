import { getImageUrl } from '@/lib/api';
import type { UserStatsResponse } from '@/lib/types';

// Draws the stats page's recap as a shareable image, entirely in the browser.
// Nothing leaves the device unless the user shares the file themselves.

export type ShareCardFormat = 'story' | 'square';

const SIZES: Record<ShareCardFormat, { width: number; height: number }> = {
    story: { width: 1080, height: 1920 },
    square: { width: 1080, height: 1080 },
};

// Same palette as the page (index.css / Stats.tsx)
const BACKGROUND = '#09090b';
const FOREGROUND = '#f4f4f5';
const MUTED = '#a1a1aa';
const ACCENT = '#2b7fff';
const DISPLAY = '"Fraunces Variable", Georgia, serif';
const SANS = '"Google Sans Flex Variable", system-ui, sans-serif';

const IMAGE_TIMEOUT_MS = 5000;

const numberFormat = new Intl.NumberFormat();

const eraLabel = (decade: number) => (decade >= 1910 && decade < 2000 ? `’${String(decade).slice(2)}s` : `${decade}s`);

// TMDB only sends CORS headers when asked and doesn't vary its cache on Origin, so a
// poster the page already showed is cached without them and fails a CORS load. A
// query string gives the card its own cache entry (TMDB ignores it).
const corsImageUrl = (path: string) => `${getImageUrl(path, 'w342')}?cors=1`;

const loadImage = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        // TMDB serves CORS headers, so the canvas stays exportable
        img.crossOrigin = 'anonymous';
        const timer = window.setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS);
        img.onload = () => {
            window.clearTimeout(timer);
            resolve(img);
        };
        img.onerror = () => {
            window.clearTimeout(timer);
            resolve(null);
        };
        img.src = src;
    });

const loadFonts = async () => {
    try {
        await Promise.all([
            document.fonts.load(`800 100px ${DISPLAY}`),
            document.fonts.load(`700 100px ${DISPLAY}`),
            document.fonts.load(`italic 400 100px ${DISPLAY}`),
            document.fonts.load(`500 100px ${SANS}`),
        ]);
    } catch {
        // Fallback fonts still draw a usable card
    }
};

const setSpacing = (ctx: CanvasRenderingContext2D, spacing: string) => {
    // letterSpacing is newer than the rest of the canvas API; skip where missing
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing;
};

// Shrink the font until the text fits the width
const fitFont = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, font: (px: number) => string) => {
    let px = size;
    ctx.font = font(px);
    while (px > 12 && ctx.measureText(text).width > maxWidth) {
        px -= 2;
        ctx.font = font(px);
    }
    return px;
};

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, radius: number) => {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    ctx.restore();
};

// The slanted poster wall from the page hero, faded into the background
const drawPosterWall = (ctx: CanvasRenderingContext2D, posters: HTMLImageElement[], width: number, wallHeight: number) => {
    if (posters.length > 0) {
        const columns = 5;
        const gap = 14;
        const posterW = (width * 1.3) / columns;
        const posterH = posterW * 1.5;
        ctx.save();
        // The tilted rows overshoot; keep them inside the wall's band
        ctx.beginPath();
        ctx.rect(0, 0, width, wallHeight);
        ctx.clip();
        ctx.globalAlpha = 0.42;
        ctx.translate(width / 2, wallHeight / 2);
        ctx.rotate((-8 * Math.PI) / 180);
        const rows = Math.ceil((wallHeight * 1.5) / (posterH + gap)) + 1;
        let i = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                const x = -width * 0.65 + col * (posterW + gap) + (row % 2) * (posterW / 2);
                const y = -wallHeight * 0.75 + row * (posterH + gap);
                drawCover(ctx, posters[i % posters.length], x, y, posterW, posterH, 16);
                i++;
            }
        }
        ctx.restore();
    }

    const fade = ctx.createLinearGradient(0, 0, 0, wallHeight);
    fade.addColorStop(0, 'rgba(9, 9, 11, 0.15)');
    fade.addColorStop(0.55, 'rgba(9, 9, 11, 0.55)');
    fade.addColorStop(1, BACKGROUND);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, wallHeight + 2);
};

type CardStat = { label: string; value: string };

const buildStats = (stats: UserStatsResponse): CardStat[] => {
    const items: CardStat[] = [];
    const hours = Math.round(stats.totals.movieMinutes / 60);
    if (hours > 0) items.push({ label: 'Hours of movies', value: `${numberFormat.format(hours)}h` });
    if (stats.timeMachine) items.push({ label: 'Your era', value: eraLabel(stats.timeMachine.era.decade) });
    if (stats.niche) items.push({ label: 'Under the radar', value: `${stats.niche.underTheRadarPercent}%` });
    if (stats.topGenres[0]) items.push({ label: 'Top genre', value: stats.topGenres[0].name });
    if (items.length < 4 && stats.languageCount > 1) items.push({ label: 'Languages', value: String(stats.languageCount) });
    return items.slice(0, 4);
};

export const renderStatsShareCard = async (stats: UserStatsResponse, format: ShareCardFormat): Promise<Blob> => {
    const { width, height } = SIZES[format];
    const isStory = format === 'story';
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported');

    const posterPaths = [...new Set([...stats.topRated.map((t) => t.posterPath), ...stats.posterWall.map((p) => p.posterPath)])]
        .filter((path): path is string => !!path)
        .slice(0, 12);
    const [, ...loaded] = await Promise.all([loadFonts(), ...posterPaths.map((path) => loadImage(corsImageUrl(path)))]);
    const posters = loaded.filter((img): img is HTMLImageElement => img !== null);

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, width, height);

    const wallHeight = isStory ? 1000 : 600;
    drawPosterWall(ctx, posters, width, wallHeight);

    const padX = 80;
    const contentWidth = width - padX * 2;
    ctx.textBaseline = 'alphabetic';

    // Eyebrow
    let y = isStory ? 860 : 340;
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${isStory ? 32 : 26}px ${SANS}`;
    setSpacing(ctx, `${isStory ? 9 : 7}px`);
    ctx.fillText((stats.year === null ? 'My life in film' : `My ${stats.year} in film`).toUpperCase(), padX, y);
    setSpacing(ctx, '0px');

    // Big count with its caption beside it
    const count = numberFormat.format(stats.totals.titles);
    const caption = stats.totals.titles === 1 ? 'title watched' : 'titles watched';
    const countSize = fitFont(ctx, count, contentWidth * 0.62, isStory ? 300 : 220, (px) => `800 ${px}px ${DISPLAY}`);
    y += countSize * 0.92;
    ctx.fillStyle = FOREGROUND;
    ctx.fillText(count, padX - countSize * 0.03, y);
    const countWidth = ctx.measureText(count).width;
    ctx.fillStyle = MUTED;
    fitFont(ctx, caption, contentWidth - countWidth - 24, isStory ? 64 : 50, (px) => `italic 400 ${px}px ${DISPLAY}`);
    ctx.fillText(caption, padX + countWidth + 20, y - (isStory ? 16 : 12));

    // Stat grid: two columns
    const items = buildStats(stats);
    const columnWidth = (contentWidth - 40) / 2;
    const rowHeight = isStory ? 190 : 150;
    const gridTop = y + (isStory ? 110 : 70);
    items.forEach((item, index) => {
        const x = padX + (index % 2) * (columnWidth + 40);
        const top = gridTop + Math.floor(index / 2) * rowHeight;
        ctx.fillStyle = ACCENT;
        ctx.fillRect(x, top, 48, 4);
        ctx.fillStyle = MUTED;
        ctx.font = `500 ${isStory ? 26 : 22}px ${SANS}`;
        setSpacing(ctx, '5px');
        ctx.fillText(item.label.toUpperCase(), x, top + (isStory ? 52 : 44));
        setSpacing(ctx, '0px');
        ctx.fillStyle = FOREGROUND;
        const valueSize = fitFont(ctx, item.value, columnWidth, isStory ? 76 : 60, (px) => `700 ${px}px ${DISPLAY}`);
        ctx.fillText(item.value, x, top + (isStory ? 52 : 44) + valueSize * 1.05);
    });

    // Director line, story only (the square has no room)
    const director = stats.topDirectors[0];
    if (isStory && director) {
        const lineY = gridTop + Math.ceil(items.length / 2) * rowHeight + 70;
        const lead = 'Kept coming back to ';
        ctx.fillStyle = MUTED;
        ctx.font = `500 30px ${SANS}`;
        ctx.fillText(lead, padX, lineY);
        const leadWidth = ctx.measureText(lead).width;
        ctx.fillStyle = FOREGROUND;
        fitFont(ctx, director.name, contentWidth - leadWidth, 40, (px) => `700 ${px}px ${DISPLAY}`);
        ctx.fillText(director.name, padX + leadWidth, lineY);
    }

    // Footer: wordmark and where to find it
    const footerY = height - (isStory ? 90 : 70);
    ctx.fillStyle = FOREGROUND;
    ctx.font = `700 ${isStory ? 52 : 44}px ${DISPLAY}`;
    ctx.fillText('mbuffs', padX, footerY);
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${isStory ? 28 : 24}px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(window.location.host, width - padX, footerY);
    ctx.textAlign = 'left';

    return new Promise<Blob>((resolve, reject) => {
        try {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png');
        } catch (error) {
            // A poster without CORS headers taints the canvas
            reject(error);
        }
    });
};

export const shareCardFileName = (stats: UserStatsResponse, format: ShareCardFormat) =>
    `mbuffs-${stats.year ?? 'all-time'}-${format}.png`;
