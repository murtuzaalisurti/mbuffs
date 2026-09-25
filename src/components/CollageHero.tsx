import { getImageUrl } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

interface CollageHeroProps {
  posters: { id: string; poster_path: string | null }[];
}

const STAGGER_MS = 35;
const STAGGER_GROUP = 16;

/**
 * The home hero: a slanted wall of posters behind the wordmark.
 * The wall drifts slowly on a loop, each poster fades in as it loads (in a
 * short stagger so the wall assembles rather than pops), and where supported
 * the wall scrolls away slower than the page for a gentle parallax.
 */
export function CollageHero({ posters }: CollageHeroProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Poster collage background — slanted, positioned behind everything including navbar */}
      {posters.length > 0 && (
        <div className="absolute inset-0 pointer-events-none collage-parallax">
          <div className="absolute inset-[-20%] flex flex-wrap gap-1.5 rotate-[-6deg] origin-center animate-[collage-drift_70s_ease-in-out_infinite_alternate]">
            {posters.map((item, index) => (
              <img
                key={item.id}
                src={getImageUrl(item.poster_path, 'w342')}
                alt=""
                className="w-[18%] md:w-[15%] lg:w-[11%] xl:w-[10%] aspect-[2/3] object-cover rounded-md opacity-0 scale-95 transition-[opacity,scale] duration-700 ease-(--ease-out) data-loaded:opacity-100 data-loaded:scale-100"
                style={{ transitionDelay: `${(index % STAGGER_GROUP) * STAGGER_MS}ms` }}
                loading="lazy"
                onLoad={(e) => {
                  e.currentTarget.dataset.loaded = '';
                }}
              />
            ))}
          </div>
        </div>
      )}
      {/* Base darkening over entire collage */}
      <div className="absolute inset-0 pointer-events-none bg-background/40" />
      {/* Smooth edge vignette on all sides */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 120px 60px oklch(0.141 0.005 285.823)' }} />
      {/* Bottom fade — taller so the tagline can sit inside it and blend into the page */}
      <div className="absolute inset-x-0 bottom-0 h-48 md:h-56 bg-gradient-to-t from-background via-background/85 to-transparent pointer-events-none" />

      {/* Navbar sits inside the hero so collage extends behind it */}
      <Navbar />

      {/* Title sits at the bottom, nestled in the fade */}
      <div className="relative z-10 container flex flex-col items-center justify-end min-h-[320px] md:min-h-[400px] lg:min-h-[460px] pb-6 md:pb-8">
        <h1 className="font-display font-extrabold tracking-tight leading-none text-6xl md:text-7xl lg:text-8xl text-foreground animate-fade-in-up">
          mbuffs
        </h1>
        <p className="mt-1 text-base md:text-lg text-muted-foreground text-center text-balance max-w-md animate-fade-in-up [animation-delay:120ms]">
          every story you love and share<span className="hidden md:inline">, or are yet to</span>
        </p>
      </div>
    </div>
  );
}

export default CollageHero;
