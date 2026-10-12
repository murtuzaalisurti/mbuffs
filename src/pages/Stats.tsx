import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  Clapperboard,
  Clock3,
  Drama,
  Film,
  History,
  Hourglass,
  Quote,
  Languages,
  Share2,
  Star,
  Telescope,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareStatsDialog } from "@/components/ShareStatsDialog";
import { fetchTasteProfileApi, fetchUserStatsApi, getImageUrl, updateTasteProfileApi } from "@/lib/api";
import { useAmbientFromImage } from "@/lib/ambient";
import { prefersReducedMotion } from "@/lib/motionPreference";
import { parseTasteSummary, plainTasteSummary } from "@/lib/tasteSummary";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { StatsPerson, StatsPoster, StatsTimelinePoint, StatsTitleRef, TasteProfileResponse, UserStatsResponse } from "@/lib/types";

// Validated (dataviz validate_palette.js, dark mode on --background): lightness band,
// CVD separation and 3:1 contrast all pass. Movies keep blue everywhere, shows orange.
const MOVIE_COLOR = "#2b7fff";
const SHOW_COLOR = "#e17100";

const PENDING_POLL_MS = 3000;
const WALL_SIZE = 32;

const numberFormat = new Intl.NumberFormat();

const monthLabel = (period: string, style: "short" | "long" = "short") => {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: style, timeZone: "UTC" });
};

const periodLabel = (period: string, style: "short" | "long" = "short") =>
  period.includes("-") ? monthLabel(period, style) : period;

const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(undefined, { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// "’90s" before 2000; "2010s" after, which is how people say them
const eraLabel = (decade: number) => (decade >= 1910 && decade < 2000 ? `’${String(decade).slice(2)}s` : `${decade}s`);

// The language's name in its own script ("한국어", "Français"); falls back to the viewer's language
const nativeLanguageName = (code: string) => {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name && name !== code ? name : languageName(code);
  } catch {
    return languageName(code);
  }
};

const formatRuntime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
};

const plural = (count: number, word: string) => `${numberFormat.format(count)} ${word}${count !== 1 ? "s" : ""}`;

const mediaPath = (mediaType: "movie" | "tv", tmdbId: number) => `/media/${mediaType}/${tmdbId}`;

// Big numbers tick up once when they arrive (skipped with reduced motion)
function useCountUp(target: number, durationMs = 900) {
  const [frame, setFrame] = useState<{ target: number; value: number } | null>(null);
  const skip = target === 0 || prefersReducedMotion();

  useEffect(() => {
    if (skip) return;
    let handle = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setFrame({ target, value: Math.round(target * eased) });
      if (progress < 1) handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [target, durationMs, skip]);

  if (skip) return target;
  return frame?.target === target ? frame.value : 0;
}

/**
 * Every bento tile: same surface, a small caps label, and a faint corner glyph
 * for its subject. A tile with its own artwork in that corner passes it as
 * `backdrop` and `icon={null}`.
 */
function Tile({
  label,
  icon: Icon,
  backdrop,
  className,
  children,
}: {
  label: string;
  icon: LucideIcon | null;
  backdrop?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.045] to-white/[0.01] p-5 md:p-6",
        className
      )}
    >
      {backdrop}
      {Icon && <Icon aria-hidden strokeWidth={1.5} className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 text-white/[0.04]" />}
      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm text-muted-foreground">{children}</p>;
}

// A small poster beside a caption, linking to the title
function TitleThumb({ item, caption, detail }: { item: StatsTitleRef; caption: string; detail: string }) {
  return (
    <Link to={mediaPath(item.mediaType, item.tmdbId)} className="group mt-5 flex items-center gap-3">
      {item.posterPath ? (
        <img
          src={getImageUrl(item.posterPath, "w185")}
          alt=""
          loading="lazy"
          className="aspect-[2/3] w-11 shrink-0 rounded-md object-cover transition-transform duration-(--dur-ui) ease-(--ease-out) group-hover:scale-105"
        />
      ) : (
        <div className="aspect-[2/3] w-11 shrink-0 rounded-md bg-muted" />
      )}
      <div className="min-w-0 text-sm">
        <p className="text-xs text-muted-foreground">{caption}</p>
        <p className="truncate font-medium group-hover:underline">{item.title ?? "Untitled"}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

type ColumnSegment = { name: string; value: number; color: string };
type ColumnDatum = { key: string; label: string; tooltipTitle: string; segments: ColumnSegment[] };

/**
 * Column chart in plain HTML: stacked segments with a 2px gap, a rounded data
 * end, and a hover/focus tooltip on the whole slot (a bigger target than the bar).
 */
function Columns({ data, height, labelEvery = 1 }: { data: ColumnDatum[]; height: string; labelEvery?: number }) {
  const max = Math.max(1, ...data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0)));

  return (
    <div>
      <div className={cn("flex items-end gap-1 border-b border-white/10", height)}>
        {data.map((datum, index) => {
          // Edge columns anchor their tooltip inward so the tile never clips it
          const position = index / Math.max(1, data.length - 1);
          const tooltipAnchor =
            position < 0.25 ? "left-0" : position > 0.75 ? "right-0" : "left-1/2 -translate-x-1/2";
          const total = datum.segments.reduce((sum, s) => sum + s.value, 0);
          const visible = datum.segments.filter((s) => s.value > 0);
          const description = `${datum.tooltipTitle}: ${datum.segments.map((s) => `${s.value} ${s.name.toLowerCase()}`).join(", ")}`;
          return (
            <div
              key={datum.key}
              tabIndex={0}
              aria-label={description}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              <div
                className="flex w-full max-w-6 flex-col-reverse gap-[2px] transition-opacity duration-(--dur-fast) group-hover:opacity-80"
                style={{ height: `${(total / max) * 100}%` }}
              >
                {visible.map((segment, index) => (
                  <div
                    key={segment.name}
                    className={cn(index === visible.length - 1 && "rounded-t-[4px]")}
                    style={{ flexGrow: segment.value, backgroundColor: segment.color, minHeight: 2 }}
                  />
                ))}
              </div>
              <div
                role="tooltip"
                className={cn("pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-white/10 bg-popover px-2.5 py-1.5 text-xs opacity-0 shadow-xl transition-opacity duration-(--dur-fast) group-hover:opacity-100 group-focus-visible:opacity-100", tooltipAnchor)}
              >
                <p className="font-medium">{datum.tooltipTitle}</p>
                {datum.segments.map((segment) => (
                  <p key={segment.name} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.name} <span className="ml-auto pl-3 tabular-nums text-foreground">{segment.value}</span>
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1">
        {data.map((datum, index) => (
          <span key={datum.key} className="flex-1 text-center text-[11px] text-muted-foreground tabular-nums">
            {index % labelEvery === 0 ? datum.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function PosterWall({ posters }: { posters: StatsPoster[] }) {
  // Repeat the posters so even a short year fills the wall
  const wall = useMemo(() => {
    if (posters.length === 0) return [];
    return Array.from({ length: WALL_SIZE }, (_, i) => ({ ...posters[i % posters.length], slot: i }));
  }, [posters]);

  if (wall.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-10 overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)]">
      <div className="absolute inset-[-25%] flex flex-wrap content-start gap-2 rotate-[-8deg] origin-center animate-[collage-drift_70s_ease-in-out_infinite_alternate]">
        {wall.map((poster) => (
          <img
            key={poster.slot}
            src={getImageUrl(poster.posterPath, "w342")}
            alt=""
            loading="lazy"
            className="w-[22%] sm:w-[16%] md:w-[12%] lg:w-[9%] aspect-[2/3] rounded-lg object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function Hero({
  stats,
  availableYears,
  year,
  onSelectYear,
  onShare,
}: {
  stats: UserStatsResponse | undefined;
  availableYears: number[];
  year: number | null;
  onSelectYear: (year: number | null) => void;
  onShare: (() => void) | null;
}) {
  const totals = stats?.totals;
  const titles = useCountUp(totals?.titles ?? 0);
  const hours = Math.round((totals?.movieMinutes ?? 0) / 60);

  return (
    <div className="relative overflow-hidden">
      <PosterWall posters={stats?.posterWall ?? []} />
      <div className="pointer-events-none absolute inset-0 bg-background/75" />
      {/* Deeper shade on the left, where the headline sits */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 140px 70px var(--background)" }} />
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-56 bg-gradient-to-t from-background via-background/90 to-transparent" />

      <Navbar />

      <div className="relative z-10 container flex min-h-[380px] flex-col justify-end pb-8 md:min-h-[460px] md:pb-10">
        <Link
          to="/profile?section=marked"
          className="mb-auto mt-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Profile
        </Link>

        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground animate-fade-in-up">
          {year === null ? "your life in film" : `your ${year} in film`}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-1 animate-fade-in-up [animation-delay:80ms]">
          <span className="font-display font-extrabold leading-[0.82] tracking-tighter text-[clamp(5.5rem,20vw,11rem)]">
            {totals ? numberFormat.format(titles) : "–"}
          </span>
          <span className="pb-2 font-display text-2xl italic text-muted-foreground md:pb-4 md:text-4xl">
            {totals?.titles === 1 ? "title watched" : "titles watched"}
          </span>
        </div>

        {totals && totals.titles > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 animate-fade-in-up [animation-delay:160ms]">
            <span className="glass inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-sm">
              <Clapperboard className="h-3.5 w-3.5" style={{ color: MOVIE_COLOR }} />
              {plural(totals.movies, "movie")}
            </span>
            <span className="glass inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-sm">
              <Tv className="h-3.5 w-3.5" style={{ color: SHOW_COLOR }} />
              {plural(totals.shows, "show")}
            </span>
            {hours > 0 && (
              <span className="glass inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-sm">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                {plural(hours, "hour")} of movies
              </span>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center gap-3 animate-fade-in-up [animation-delay:240ms]">
        {availableYears.length > 0 && (
          <div
            role="group"
            aria-label="Choose a year"
            className="-ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pl-4 scrollbar-hide"
          >
            {[null, ...availableYears].map((option) => {
              const active = option === year;
              return (
                <button
                  key={option ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectYear(option)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-(--dur-fast)",
                    active
                      ? "bg-foreground text-background"
                      : "glass border border-white/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option ?? "All time"}
                </button>
              );
            })}
          </div>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-4 py-1.5 text-sm font-medium glass transition-colors duration-(--dur-fast) hover:bg-white/10"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

function TimeTile({ stats }: { stats: UserStatsResponse }) {
  const { movieMinutes, moviesWithRuntime, movies } = stats.totals;
  const hours = useCountUp(Math.round(movieMinutes / 60));
  const days = movieMinutes / 60 / 24;

  return (
    <Tile label="Time spent watching" icon={Clock3} className="md:col-span-2">
      <p className="mt-4 font-display text-6xl font-bold tracking-tight">
        {numberFormat.format(hours)}
        <span className="ml-1 text-2xl font-medium text-muted-foreground">h</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {days >= 1 ? `That's ${days.toFixed(1)} days of movies, back to back.` : "Of movies, start to finish."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Movies only for now: shows aren't tracked by episode yet.
        {moviesWithRuntime < movies ? ` From ${moviesWithRuntime} of ${movies} movies with a known runtime.` : ""}
      </p>
    </Tile>
  );
}

const nichePersona = (percent: number) => {
  if (percent < 15) return "Crowd favourite";
  if (percent < 35) return "Mostly mainstream";
  if (percent < 60) return "Off the beaten path";
  return "Deep-cut digger";
};

function NicheTile({ stats }: { stats: UserStatsResponse }) {
  const niche = stats.niche;
  const percent = useCountUp(niche?.underTheRadarPercent ?? 0);

  return (
    <Tile label="How niche are you" icon={Telescope} className="md:col-span-2">
      {niche ? (
        <>
          <p className="mt-4 font-display text-6xl font-bold tracking-tight">
            {percent}
            <span className="ml-1 text-2xl font-medium text-muted-foreground">%</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            under the radar. <span className="text-foreground">{nichePersona(niche.underTheRadarPercent)}.</span>
          </p>
          {/* Where you sit between mainstream and niche */}
          <div className="mt-5" role="img" aria-label={`${niche.underTheRadarPercent}% of your titles are little-known`}>
            <div className="relative h-1.5 rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full" style={{ width: `${niche.underTheRadarPercent}%`, backgroundColor: MOVIE_COLOR }} />
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
                style={{ left: `${niche.underTheRadarPercent}%`, backgroundColor: MOVIE_COLOR }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>Mainstream</span>
              <span>Niche</span>
            </div>
          </div>
          {niche.deepestCut && (
            <TitleThumb
              item={niche.deepestCut}
              caption="Deepest cut"
              detail={`Only ${plural(niche.deepestCut.voteCount, "rating")} on TMDB`}
            />
          )}
        </>
      ) : (
        <EmptyNote>No audience data yet.</EmptyNote>
      )}
    </Tile>
  );
}

function TimeMachineTile({ stats }: { stats: UserStatsResponse }) {
  const machine = stats.timeMachine;
  const oldestYear = machine?.oldest.releaseYear ?? null;
  const span = machine && oldestYear !== null ? machine.newestYear - oldestYear : 0;

  return (
    <Tile label="Time machine" icon={Hourglass} className="md:col-span-2">
      {machine ? (
        <>
          <p className="mt-4 font-display text-5xl font-bold tracking-tight">{eraLabel(machine.era.decade)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your era: <span className="text-foreground">{machine.era.percent}%</span> of what you watched came out then.
          </p>
          {oldestYear !== null && span > 0 && (
            // Your whole range, with the era's decade lit up
            <div className="mt-5" role="img" aria-label={`Films from ${oldestYear} to ${machine.newestYear}, mostly from the ${eraLabel(machine.era.decade)}`}>
              <div className="relative h-1.5 rounded-full bg-white/[0.08]">
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${(Math.max(0, machine.era.decade - oldestYear) / span) * 100}%`,
                    right: `${(Math.max(0, machine.newestYear - (machine.era.decade + 9)) / span) * 100}%`,
                    backgroundColor: MOVIE_COLOR,
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{oldestYear}</span>
                <span>{machine.newestYear}</span>
              </div>
            </div>
          )}
          <TitleThumb item={machine.oldest} caption="Oldest you watched" detail={String(oldestYear ?? "")} />
        </>
      ) : (
        <EmptyNote>No release dates yet.</EmptyNote>
      )}
    </Tile>
  );
}

function TasteTile({ year, taste, isLoading }: { year: number | null; taste: TasteProfileResponse | undefined; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: updateTasteProfileApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", "stats", "taste"] }),
  });

  const turnOff = (
    <button
      type="button"
      onClick={() => toggle.mutate(false)}
      disabled={toggle.isPending}
      className="underline-offset-4 hover:text-foreground hover:underline"
    >
      Turn off
    </button>
  );

  let body: React.ReactNode;
  if (isLoading || !taste) {
    body = (
      <div className="mt-5 space-y-3" role="status" aria-label="Reading your reviews and ratings">
        <Skeleton className="h-7 w-full rounded-md" />
        <Skeleton className="h-7 w-2/3 rounded-md" />
      </div>
    );
  } else if (taste.status === "disabled") {
    body = (
      <>
        <p className="mt-4 max-w-2xl font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Your taste profile is off
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Turn it back on for a short profile of what you love and what loses you, based on your reviews and ratings.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button onClick={() => toggle.mutate(true)} disabled={toggle.isPending}>
            Turn on
          </Button>
          <p className="text-xs text-muted-foreground">
            Your reviews and ratings may be sent to AI.
          </p>
        </div>
      </>
    );
  } else if (taste.status === "not_enough") {
    const needed = taste.minSignals - taste.commentCount - taste.ratingCount;
    body = (
      <>
        <p className="mt-4 font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {needed} more to go
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your profile needs at least {taste.minSignals} reviews or ratings{year === null ? "" : ` from ${year}`}. Rate or
          review what you watch to unlock it. · {turnOff}
        </p>
      </>
    );
  } else if (taste.status === "unavailable" || !taste.summary) {
    body = (
      <p className="mt-4 text-sm text-muted-foreground">
        Couldn't write your profile right now. Try again later. · {turnOff}
      </p>
    );
  } else {
    body = (
      <>
        {/* Titles it names are set large; the phrases that sum up your taste stand out; the rest stays quiet */}
        <p className="mt-8 max-w-4xl text-lg leading-[1.8] text-muted-foreground md:mt-10 md:text-xl">
          {parseTasteSummary(taste.summary).map((segment, index) =>
            segment.kind === "title" ? (
              <span
                key={index}
                className="mx-0.5 font-display text-2xl font-bold italic leading-none tracking-tight text-foreground md:text-[1.75rem]"
              >
                {segment.text}
              </span>
            ) : segment.kind === "phrase" ? (
              <span
                key={index}
                className="font-medium text-foreground underline decoration-2 underline-offset-[6px]"
                style={{ textDecorationColor: `color-mix(in oklch, ${MOVIE_COLOR} 70%, transparent)` }}
              >
                {segment.text}
              </span>
            ) : (
              <span key={index}>{segment.text}</span>
            )
          )}
        </p>
        <p className="mt-8 text-xs text-muted-foreground md:mt-10">
          Based on{" "}
          {[
            taste.commentCount > 0 ? plural(taste.commentCount, "review") : null,
            taste.ratingCount > 0 ? plural(taste.ratingCount, "rating") : null,
          ]
            .filter(Boolean)
            .join(" and ")}
          . Your reviews and ratings may be sent to AI. · {turnOff}
        </p>
      </>
    );
  }

  return (
    <Tile label="Your taste, in a nutshell" icon={Quote} className="md:col-span-6">
      {body}
    </Tile>
  );
}

function TimelineTile({ stats }: { stats: UserStatsResponse }) {
  const peak = stats.timeline.reduce<StatsTimelinePoint | null>((best, point) => {
    const total = point.movies + point.shows;
    if (total === 0) return best;
    return !best || total > best.movies + best.shows ? point : best;
  }, null);
  const isMonthly = stats.year !== null;
  const labelEvery = isMonthly ? 1 : Math.ceil(stats.timeline.length / 12);

  return (
    <Tile label={isMonthly ? "Month by month" : "Year by year"} icon={CalendarDays} className="md:col-span-6">
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        {peak && (
          <p className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {periodLabel(peak.period, "long")} was your peak
            <span className="ml-2 text-lg font-medium text-muted-foreground">{plural(peak.movies + peak.shows, "title")}</span>
          </p>
        )}
        <div className="flex gap-4">
          <LegendDot color={MOVIE_COLOR} label="Movies" />
          <LegendDot color={SHOW_COLOR} label="Shows" />
        </div>
      </div>
      <div className="mt-8">
        <Columns
          height="h-44 md:h-52"
          labelEvery={labelEvery}
          data={stats.timeline.map((point) => ({
            key: point.period,
            label: periodLabel(point.period),
            tooltipTitle: periodLabel(point.period, "long"),
            segments: [
              { name: "Movies", value: point.movies, color: MOVIE_COLOR },
              { name: "Shows", value: point.shows, color: SHOW_COLOR },
            ],
          }))}
        />
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">{isMonthly ? "Month" : "Year"}</th>
              <th className="py-1 text-right font-normal">Movies</th>
              <th className="py-1 text-right font-normal">Shows</th>
            </tr>
          </thead>
          <tbody>
            {stats.timeline.map((point) => (
              <tr key={point.period} className="border-t border-white/[0.06]">
                <td className="py-1">{periodLabel(point.period, "long")}</td>
                <td className="py-1 text-right">{point.movies}</td>
                <td className="py-1 text-right">{point.shows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Tile>
  );
}

function GenreTile({ stats }: { stats: UserStatsResponse }) {
  const [top, ...rest] = stats.topGenres;
  const max = Math.max(1, ...rest.map((genre) => genre.count));
  const min = Math.min(...rest.map((genre) => genre.count));

  return (
    <Tile label="Your genre" icon={Drama} className="md:col-span-3">
      {top ? (
        <>
          <p className="mt-4 font-display text-5xl font-bold tracking-tight md:text-6xl">{top.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            In {Math.round((top.count / Math.max(1, stats.totals.titles)) * 100)}% of everything you watched.
          </p>
          {rest.length > 0 && (
            // The rest set in type: size and brightness follow how often you watched each
            <ul className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-label="Your other genres">
              {rest.map((genre) => {
                const weight = max === min ? 1 : (genre.count - min) / (max - min);
                return (
                  <li
                    key={genre.id}
                    className="font-display font-semibold leading-tight tracking-tight"
                    style={{
                      fontSize: `${1 + weight * 1.1}rem`,
                      color: `color-mix(in oklch, var(--foreground) ${Math.round(45 + weight * 55)}%, transparent)`,
                    }}
                  >
                    {genre.name}
                    <sup className="ml-0.5 font-sans text-[10px] font-medium text-muted-foreground tabular-nums">{genre.count}</sup>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <EmptyNote>No genre details yet.</EmptyNote>
      )}
    </Tile>
  );
}

function Avatar({ person, className }: { person: StatsPerson; className?: string }) {
  return person.profilePath ? (
    <img src={getImageUrl(person.profilePath, "w185")} alt="" loading="lazy" className={cn("rounded-full bg-muted object-cover", className)} />
  ) : (
    <span className={cn("flex items-center justify-center rounded-full bg-muted font-display text-muted-foreground", className)}>
      {person.name.charAt(0)}
    </span>
  );
}

function DirectorTile({ stats }: { stats: UserStatsResponse }) {
  const [top, ...rest] = stats.topDirectors;
  return (
    // The portrait takes the glyph's corner when there is one
    <Tile
      label="Director you kept coming back to"
      icon={top?.profilePath ? null : Clapperboard}
      className="md:col-span-3 min-h-72"
      backdrop={
        top?.profilePath && (
          <img
            src={getImageUrl(top.profilePath, "w342")}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-3/5 object-cover object-top opacity-60 [mask-image:linear-gradient(to_left,black_30%,transparent)]"
          />
        )
      }
    >
      {top ? (
        <div className="relative">
          <Link to={`/person/${top.id}`} className="mt-4 block w-fit font-display text-4xl font-bold leading-tight tracking-tight hover:underline md:text-5xl">
            {top.name}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{plural(top.count, "title")} you watched</p>
          {rest.length > 0 && (
            <ul className="mt-8 space-y-2.5">
              {rest.map((person) => (
                <li key={person.id}>
                  <Link to={`/person/${person.id}`} className="flex w-fit items-center gap-3 text-sm hover:text-foreground">
                    <Avatar person={person} className="h-8 w-8 text-xs" />
                    <span>{person.name}</span>
                    <span className="tabular-nums text-muted-foreground">{person.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <EmptyNote>No director details yet.</EmptyNote>
      )}
    </Tile>
  );
}

function ActorsTile({ stats }: { stats: UserStatsResponse }) {
  return (
    <Tile label="Faces you saw most" icon={Users} className="md:col-span-4">
      {stats.topActors.length > 0 ? (
        <ol className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5">
          {stats.topActors.map((person, index) => (
            <li key={person.id}>
              <Link to={`/person/${person.id}`} className="group flex flex-col items-center text-center">
                <span className="relative">
                  <Avatar
                    person={person}
                    className={cn(
                      "h-20 w-20 text-2xl ring-2 ring-white/10 transition-transform duration-(--dur-ui) ease-(--ease-out) group-hover:scale-105",
                      index === 0 && "ring-white/40"
                    )}
                  />
                  {/* Rank, not a count: the list is already ordered by titles */}
                  <span className="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-foreground px-1 text-[11px] font-semibold text-background tabular-nums">
                    {index + 1}
                  </span>
                </span>
                <span className="mt-3 line-clamp-2 text-sm leading-tight">{person.name}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyNote>No cast details yet.</EmptyNote>
      )}
    </Tile>
  );
}

function LongestTile({ stats }: { stats: UserStatsResponse }) {
  const movie = stats.longestMovie;
  return (
    <Tile label="Longest sit" icon={Film} className="md:col-span-2">
      {movie ? (
        <Link to={mediaPath("movie", movie.tmdbId)} className="group mt-4 flex gap-4">
          {movie.posterPath ? (
            <img
              src={getImageUrl(movie.posterPath, "w185")}
              alt=""
              loading="lazy"
              className="aspect-[2/3] w-20 shrink-0 rounded-lg object-cover transition-transform duration-(--dur-ui) ease-(--ease-out) group-hover:scale-[1.03]"
            />
          ) : (
            <div className="aspect-[2/3] w-20 shrink-0 rounded-lg bg-muted" />
          )}
          <div className="min-w-0">
            <p className="font-display text-4xl font-bold tracking-tight">{formatRuntime(movie.runtimeMinutes)}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground group-hover:text-foreground">{movie.title ?? "Untitled"}</p>
          </div>
        </Link>
      ) : (
        <EmptyNote>No movie runtimes yet.</EmptyNote>
      )}
    </Tile>
  );
}

function DecadesTile({ stats }: { stats: UserStatsResponse }) {
  return (
    <Tile label="Release decades" icon={History} className="md:col-span-3">
      {stats.decades.length > 0 ? (
        <>
          <p className="mt-4 font-display text-3xl font-bold tracking-tight">
            Everything you watched spans {plural(stats.decades.length, "decade")}
          </p>
          <div className="mt-6">
            <Columns
              height="h-28"
              data={stats.decades.map((d) => ({
                key: String(d.decade),
                label: `'${String(d.decade).slice(2)}`,
                tooltipTitle: `${d.decade}s`,
                segments: [{ name: "Titles", value: d.count, color: MOVIE_COLOR }],
              }))}
            />
          </div>
        </>
      ) : (
        <EmptyNote>No release dates yet.</EmptyNote>
      )}
    </Tile>
  );
}

function LanguagesTile({ stats }: { stats: UserStatsResponse }) {
  const english = stats.languages.find((language) => language.code === "en")?.count ?? 0;
  const beyondEnglish = Math.round(((stats.totals.titles - english) / Math.max(1, stats.totals.titles)) * 100);

  return (
    <Tile label="Languages" icon={Languages} className="md:col-span-3">
      {stats.languages.length > 0 ? (
        <>
          <p className="mt-4 font-display text-3xl font-bold tracking-tight">{plural(stats.languageCount, "language")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="text-foreground">{beyondEnglish}%</span> of what you watched wasn't in English.
          </p>
          {/* Each language in its own script, the English name beneath */}
          <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.languages.map((language, index) => {
              const native = nativeLanguageName(language.code);
              const local = languageName(language.code);
              return (
                <li
                  key={language.code}
                  className={cn(
                    "min-w-0 rounded-2xl border bg-white/[0.03] px-3 py-2.5",
                    index === 0 ? "border-white/20" : "border-white/[0.06]"
                  )}
                >
                  <p className="truncate font-display text-xl font-semibold tracking-tight first-letter:uppercase" lang={language.code}>{native}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {native !== local ? `${local} · ` : ""}
                    <span className="tabular-nums">{plural(language.count, "title")}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyNote>No language details yet.</EmptyNote>
      )}
    </Tile>
  );
}

function TopRatedRail({ stats }: { stats: UserStatsResponse }) {
  if (stats.topRated.length === 0) return null;
  return (
    <section className="reveal">
      <h2 className="section-title mb-2">your highest rated</h2>
      {/* Vertical padding leaves room for the tilted posters, which the scroller would clip */}
      <ol className="rail -mx-4 gap-2 px-4 py-6">
        {stats.topRated.map((item, index) => (
          <li key={`${item.mediaType}:${item.tmdbId}`} className="shrink-0">
            {/* Each poster turns toward its number like a fanned card; the number sits in front of its edge */}
            <Link to={mediaPath(item.mediaType, item.tmdbId)} className="group flex items-end [perspective:700px]">
              <span
                aria-hidden
                className="relative z-10 -mr-8 select-none font-display text-[7.5rem] font-extrabold leading-[0.8] text-background [-webkit-text-stroke:3px_var(--muted-foreground)] [paint-order:stroke_fill] md:-mr-10 md:text-[9rem]"
              >
                {index + 1}
              </span>
              <span className="relative block w-32 origin-left [transform:rotateY(-28deg)] transition-transform duration-(--dur-ui) ease-(--ease-out) group-hover:[transform:rotateY(0deg)_translateY(-4px)] md:w-40">
                {item.posterPath ? (
                  <img
                    src={getImageUrl(item.posterPath, "w342")}
                    alt={item.title ?? ""}
                    loading="lazy"
                    className="aspect-[2/3] w-full rounded-xl object-cover shadow-2xl shadow-black/60"
                  />
                ) : (
                  <span className="block aspect-[2/3] w-full rounded-xl bg-muted" />
                )}
                <span className="glass absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-xs font-semibold">
                  <Star className="h-3 w-3 fill-current" />
                  {item.rating}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-4">
      {["md:col-span-2", "md:col-span-2", "md:col-span-2", "md:col-span-6", "md:col-span-3", "md:col-span-3"].map((span, i) => (
        <Skeleton key={i} className={cn("rounded-3xl", span, i === 3 ? "h-72" : "h-48")} />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
      <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default function Stats() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = Number(searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam > 1900 ? yearParam : null;

  const { data: stats, isLoading, isError } = useQuery<UserStatsResponse, Error>({
    queryKey: ["user", "stats", year ?? "all"],
    queryFn: () => fetchUserStatsApi(year),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    // Metadata for older watched titles is cached in batches; keep polling until it is all in
    refetchInterval: (query) => (query.state.data?.metadataPending ? PENDING_POLL_MS : false),
  });

  // Separate from the stats so a slow AI write never holds up the page
  const { data: taste, isLoading: isTasteLoading } = useQuery<TasteProfileResponse, Error>({
    queryKey: ["user", "stats", "taste", year ?? "all"],
    queryFn: () => fetchTasteProfileApi(year),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // The favourite title lights the room
  useAmbientFromImage(stats?.topRated[0]?.posterPath ?? stats?.posterWall[0]?.posterPath);

  const availableYears = stats?.availableYears ?? (year !== null ? [year] : []);
  const selectYear = (next: number | null) => {
    setSearchParams(next === null ? {} : { year: String(next) }, { replace: true });
  };

  const hasData = !!stats && stats.totals.titles > 0;
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <Hero
        stats={stats}
        availableYears={availableYears}
        year={year}
        onSelectYear={selectYear}
        onShare={hasData ? () => setShareOpen(true) : null}
      />
      {stats && hasData && (
        <ShareStatsDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          stats={stats}
          tasteSummary={taste?.status === "ready" && taste.summary ? plainTasteSummary(taste.summary) : null}
        />
      )}

      <main className="container pb-10">
        {isLoading ? (
          <StatsSkeleton />
        ) : isError || !stats ? (
          <EmptyState title="Couldn't load your stats" body="Try again in a moment." />
        ) : !hasData ? (
          <EmptyState
            title="Nothing here yet"
            body={year === null ? "Mark movies and shows as watched to see your stats." : `You didn't mark anything as watched in ${year}.`}
          />
        ) : (
          <div className="space-y-12">
            {stats.metadataPending > 0 && (
              <p className="glass rounded-full border border-white/10 px-4 py-2 text-center text-sm text-muted-foreground" role="status">
                Still loading details for {plural(stats.metadataPending, "title")}. Everything updates on its own.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-4 animate-stagger">
              <TimeTile stats={stats} />
              <NicheTile stats={stats} />
              <TimeMachineTile stats={stats} />
              <TasteTile year={year} taste={taste} isLoading={isTasteLoading} />
              <TimelineTile stats={stats} />
              <GenreTile stats={stats} />
              <DirectorTile stats={stats} />
              <ActorsTile stats={stats} />
              <LongestTile stats={stats} />
              <DecadesTile stats={stats} />
              <LanguagesTile stats={stats} />
            </div>

            <TopRatedRail stats={stats} />

            <p className="text-xs text-muted-foreground">
              Dates come from when you marked a title as watched, not when you saw it. Hours count movies only.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
