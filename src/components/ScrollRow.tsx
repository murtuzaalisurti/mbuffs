import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollRowProps {
  children: ReactNode;
  /** Spacing between items (and any other scroller classes) */
  className?: string;
  /** Lay the same items out as a wrapping grid instead (no scrolling, no arrows) */
  gridClassName?: string;
  /** Access to the scroller element, e.g. to observe or name its items */
  scrollerRef?: RefObject<HTMLDivElement | null>;
  /**
   * Where the row runs into the page gutters. "always" suits full-width pages;
   * "mobile" keeps the row within its column from md up, for columns that sit
   * beside a sidebar, so it shares the column's edges with the text around it.
   */
  bleed?: 'always' | 'mobile';
}

/**
 * The app's one horizontal row: items snap into place, the row bleeds into the
 * page gutters (see `bleed`) so edge items aren't cut short, and on pointer
 * devices quiet glass arrows appear on hover whenever there is somewhere to
 * scroll to.
 */
export function ScrollRow({ children, className = 'gap-4', gridClassName, scrollerRef, bleed = 'always' }: ScrollRowProps) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = scrollerRef ?? ownRef;
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const isGrid = Boolean(gridClassName);

  const updateEdges = () => {
    const scroller = ref.current;
    if (!scroller) return;
    const atStart = scroller.scrollLeft <= 4;
    const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
  };

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    // Size changes (and items arriving) can create or remove overflow
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    for (const child of scroller.children) observer.observe(child);
    return () => observer.disconnect();
  });

  const scrollByPage = (direction: 1 | -1) => {
    const scroller = ref.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: 'smooth' });
  };

  const arrowClass =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full glass text-foreground ring-1 ring-border shadow-lg shadow-black/40 transition-[opacity,scale] duration-(--dur-ui) ease-(--ease-out) hover:scale-105 pointer-fine:flex';
  const contained = bleed === 'mobile';
  // Contained rows centre their arrows on the column edges, clear of the posters
  const backArrowPosition = contained ? 'left-3 md:left-0 md:-translate-x-1/2' : 'left-3';
  const forwardArrowPosition = contained ? 'right-3 md:right-0 md:translate-x-1/2' : 'right-3';
  const gutter = contained ? 'px-8 md:px-0 md:[scroll-padding-inline:0]' : 'px-8';
  const arrowVisibility = (atEdge: boolean) =>
    atEdge ? 'pointer-events-none opacity-0 scale-90' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100';

  return (
    <div className={`group/row relative ${contained ? '-mx-8 md:mx-0' : '-mx-8'}`}>
      <div
        ref={ref}
        onScroll={isGrid ? undefined : updateEdges}
        className={isGrid ? `grid ${gutter} pt-1 pb-3 ${gridClassName}` : `rail ${gutter} pt-1 pb-3 ${className}`}
      >
        {children}
      </div>

      {!isGrid && (
        <>
          <button
            type="button"
            aria-label="Scroll back"
            onClick={() => scrollByPage(-1)}
            className={`${arrowClass} ${backArrowPosition} ${arrowVisibility(edges.atStart)}`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Scroll forward"
            onClick={() => scrollByPage(1)}
            className={`${arrowClass} ${forwardArrowPosition} ${arrowVisibility(edges.atEnd)}`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

export default ScrollRow;
