import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Movie } from '@/lib/types';
import { getImageUrl } from '@/lib/api';
import { useAmbientFromImage } from '@/lib/ambient';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface FeaturedHeroProps {
  items: Movie[];
  /** Small line above the title, after the title's rank, e.g. "trending this week" */
  eyebrow?: string;
}

const SLIDE_MS = 8000;

/**
 * One title at a time, full-bleed, like the moment before the lights go down.
 * Slides advance when the active progress bar finishes filling, so pausing
 * the bar (hover, focus) pauses the rotation with no separate timer to keep
 * in sync. The room's ambient light follows the featured title.
 */
export function FeaturedHero({ items, eyebrow = 'trending this week' }: FeaturedHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const active = items[activeIndex] ?? items[0];

  useAmbientFromImage(active?.poster_path);

  if (!active) return null;

  const goTo = (index: number) => setActiveIndex((index + items.length) % items.length);
  const autoplay = !prefersReducedMotion && items.length > 1;

  const title = active.title || active.name;
  const year = (active.release_date || active.first_air_date || '').slice(0, 4);
  const mediaType = active.first_air_date ? 'tv' : 'movie';
  const rating = active.vote_average > 0 ? active.vote_average.toFixed(1) : null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured titles"
      className="relative isolate w-full h-[72svh] min-h-[460px] max-h-[780px] overflow-hidden"
      style={{ marginTop: 'calc(-4rem - env(safe-area-inset-top))' }}
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {/* Artwork: every slide stays mounted so switching is a cross-fade, but
          only the active and next slides load their images. */}
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const shouldLoad = isActive || index === (activeIndex + 1) % items.length;
        return (
          <div
            key={item.id}
            aria-hidden={!isActive}
            className={`absolute inset-0 -z-10 fade-out-bottom transition-opacity duration-[1200ms] ease-(--ease-out) ${isActive ? 'opacity-100' : 'opacity-0'}`}
          >
            {shouldLoad && (
              <picture>
                {item.backdrop_path && (
                  <source media="(min-width: 640px)" srcSet={getImageUrl(item.backdrop_path, 'w1280')} />
                )}
                <img
                  src={getImageUrl(item.poster_path || item.backdrop_path, 'w780')}
                  alt=""
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  className={`h-full w-full object-cover object-[50%_25%] ${isActive && !prefersReducedMotion ? 'animate-[hero-drift_12s_linear_both]' : ''}`}
                />
              </picture>
            )}
          </div>
        );
      })}

      {/* Scrims give the type a quiet corner; they fade out with the artwork */}
      <div className="absolute inset-0 -z-10 fade-out-bottom bg-linear-to-t from-background/70 via-background/30 to-background/5" />
      <div className="absolute inset-0 -z-10 fade-out-bottom bg-linear-to-r from-background/75 via-background/10 to-transparent" />

      <div className="container relative flex h-full flex-col justify-end pb-10 md:pb-16">
        <div key={active.id} className="max-w-2xl" aria-live="polite">
          <p className="text-sm font-medium text-muted-foreground lowercase animate-fade-in-up">#{activeIndex + 1} {eyebrow}</p>
          <h1 className="mt-2 font-display font-extrabold tracking-tight leading-none text-balance text-5xl sm:text-6xl lg:text-7xl text-foreground animate-fade-in-up [animation-delay:60ms]">
            {title}
          </h1>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground animate-fade-in-up [animation-delay:120ms]">
            {year && <span>{year}</span>}
            {year && rating && <span aria-hidden className="text-muted-foreground/40">•</span>}
            {rating && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" />
                {rating}
              </span>
            )}
            <span aria-hidden className="text-muted-foreground/40">•</span>
            <span>{mediaType === 'tv' ? 'Series' : 'Movie'}</span>
          </div>
          {active.overview && (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/75 line-clamp-2 max-sm:hidden animate-fade-in-up [animation-delay:180ms]">
              {active.overview}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3 animate-fade-in-up [animation-delay:240ms]">
            <Button asChild size="lg">
              <Link to={`/media/${mediaType}/${active.id}`} viewTransition>
                View details
              </Link>
            </Button>
          </div>
        </div>

        {/* Progress bars double as slide pickers */}
        {items.length > 1 && (
          <div className="mt-8 flex gap-1.5" role="tablist" aria-label="Choose featured title">
            {items.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={item.title || item.name}
                  onClick={() => goTo(index)}
                  className="group relative h-6 w-8 sm:w-10"
                >
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/20 transition-colors group-hover:bg-foreground/35">
                    <span
                      className={`absolute inset-0 origin-left rounded-full bg-foreground ${
                        index < activeIndex ? 'scale-x-100' : 'scale-x-0'
                      }`}
                      style={
                        isActive
                          ? autoplay
                            ? {
                                animation: `hero-progress ${SLIDE_MS}ms linear forwards`,
                                animationPlayState: isPaused ? 'paused' : 'running',
                              }
                            : { transform: 'scaleX(1)' }
                          : undefined
                      }
                      onAnimationEnd={isActive ? () => goTo(activeIndex + 1) : undefined}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default FeaturedHero;
