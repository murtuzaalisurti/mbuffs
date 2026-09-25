import { Children, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface RailProps {
  title: ReactNode;
  /** Small line under the title, e.g. why these picks were made */
  subtitle?: ReactNode;
  /** Right-aligned header slot, typically a "See all" link */
  action?: ReactNode;
  /** Width classes for each item; posters by default */
  itemClassName?: string;
  /** Title toggles between a single scrolling row and a full grid */
  expandable?: boolean;
  children: ReactNode;
}

const STAGGER_MS = 40;
const MAX_STAGGERED_ITEMS = 10;

/**
 * A titled, horizontally scrolling set of posters. Items snap into place, fade
 * up in a short stagger the first time the rail scrolls into view, and (on
 * pointer devices) get quiet edge arrows once there is somewhere to scroll to.
 *
 * When expandable, the title toggles between that single row and a regular
 * wrapping grid of every item. The grid starts with the same leading titles,
 * and each poster glides to its new place via a view transition.
 */
export function Rail({
  title,
  subtitle,
  action,
  itemClassName = 'w-[140px] sm:w-[160px] md:w-[180px]',
  expandable = false,
  children,
}: RailProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const transitionPrefix = `rail${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const isGrid = expandable && expanded;

  const updateEdges = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const atStart = scroller.scrollLeft <= 4;
    const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const revealObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          updateEdges();
          revealObserver.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    revealObserver.observe(scroller);
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(scroller);
    return () => {
      revealObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  const toggleExpanded = () => {
    const next = !expanded;
    const scroller = scrollerRef.current;
    const section = sectionRef.current;
    if (!scroller || !section || typeof document.startViewTransition !== 'function') {
      setExpanded(next);
      return;
    }

    // Name the posters (and the sections below, which shift) only for this
    // transition, so page navigations never see dozens of named elements.
    const named = [...scroller.children] as HTMLElement[];
    for (let sibling = section.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      named.push(sibling as HTMLElement);
    }
    named.forEach((el, index) => {
      el.style.viewTransitionName = `${transitionPrefix}-${index}`;
    });

    const transition = document.startViewTransition(() => {
      flushSync(() => setExpanded(next));
    });
    transition.finished.finally(() => {
      named.forEach((el) => {
        el.style.viewTransitionName = '';
      });
      updateEdges();
    });
  };

  const scrollByPage = (direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: 'smooth' });
  };

  const arrowClass =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full glass text-foreground ring-1 ring-border shadow-lg shadow-black/40 transition-[opacity,scale] duration-(--dur-ui) ease-(--ease-out) hover:scale-105 pointer-fine:flex';

  const heading = (
    <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight lowercase">{title}</h2>
  );

  return (
    <section ref={sectionRef} className="group/rail space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {expandable ? (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              className="group flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {heading}
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-(--dur-ui) ease-(--ease-emph) group-hover:text-foreground ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            heading
          )}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      {/* Spans the page gutters so edge posters and arrows aren't clipped */}
      <div className="relative -mx-8">
        <div
          ref={scrollerRef}
          onScroll={updateEdges}
          className={
            isGrid
              ? 'grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 px-8 pt-1 pb-3'
              : 'rail gap-4 px-8 pt-1 pb-3'
          }
        >
          {Children.map(children, (child, index) => (
            <div
              className={`${isGrid ? '' : `shrink-0 ${itemClassName}`} ${revealed ? 'animate-fade-in-up' : 'opacity-0'}`}
              style={revealed ? { animationDelay: `${Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_MS}ms` } : undefined}
            >
              {child}
            </div>
          ))}
        </div>

        {!isGrid && (
          <>
            <button
              type="button"
              aria-label="Scroll back"
              onClick={() => scrollByPage(-1)}
              className={`${arrowClass} left-3 ${edges.atStart ? 'pointer-events-none opacity-0 scale-90' : 'opacity-0 group-hover/rail:opacity-100'}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Scroll forward"
              onClick={() => scrollByPage(1)}
              className={`${arrowClass} right-3 ${edges.atEnd ? 'pointer-events-none opacity-0 scale-90' : 'opacity-0 group-hover/rail:opacity-100'}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** Placeholder rail with the real rail's proportions. */
export function RailSkeleton({ itemClassName = 'w-[140px] sm:w-[160px] md:w-[180px]' }: { itemClassName?: string }) {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="flex gap-4 overflow-hidden -mx-8 px-8 pt-1 pb-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className={`shrink-0 ${itemClassName} aspect-2/3 rounded-xl`} />
        ))}
      </div>
    </div>
  );
}
