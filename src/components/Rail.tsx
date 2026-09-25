import { Children, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { ScrollRow } from '@/components/ScrollRow';
import { Skeleton } from '@/components/ui/skeleton';
import { isHistoryNavigation } from '@/lib/navigationMotion';

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
 * A titled, horizontally scrolling set of posters (a ScrollRow) whose items
 * fade up in a short stagger the first time the rail scrolls into view.
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
  // Coming back to a page shows its rails as they were, without replaying the reveal
  const [revealed, setRevealed] = useState(isHistoryNavigation);
  const [expanded, setExpanded] = useState(false);
  const transitionPrefix = `rail${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const isGrid = expandable && expanded;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const revealObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          revealObserver.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    revealObserver.observe(scroller);
    return () => revealObserver.disconnect();
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
    });
  };

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

      <ScrollRow
        scrollerRef={scrollerRef}
        gridClassName={isGrid ? 'grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5' : undefined}
      >
        {Children.map(children, (child, index) => (
          <div
            className={`${isGrid ? '' : `shrink-0 ${itemClassName}`} ${revealed ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={revealed ? { animationDelay: `${Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_MS}ms` } : undefined}
          >
            {child}
          </div>
        ))}
      </ScrollRow>
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
