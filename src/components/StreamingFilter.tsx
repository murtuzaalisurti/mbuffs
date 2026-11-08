import { useMemo, useState } from "react";
import { Check, ChevronDown, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { StreamingFilterState, useWatchProviderRegions } from "@/hooks/useStreamingFilter";
import { getBrandName, OFFER_LABELS, OFFER_TYPES, OfferType, StreamingSelection } from "@/lib/streamingProviders";

const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w92";
const DEFAULT_REGION_VALUE = "default";

// "Any way to watch", "Rent only", "Stream or buy", "Stream, rent or buy".
const describeOffers = (selected: OfferType[] | null): string => {
  if (!selected || selected.length === 0) return "Any way to watch";
  const labels = OFFER_TYPES.filter((offer) => selected.includes(offer)).map((offer, index) =>
    index === 0 ? OFFER_LABELS[offer] : OFFER_LABELS[offer].toLowerCase(),
  );
  if (labels.length === 1) return `${labels[0]} only`;
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
};

interface StreamingFilterProps {
  filter: StreamingFilterState;
  /** Titles per brand among the current items; brands with none are hidden. */
  counts?: Record<string, number>;
  /** Called after any change, e.g. to reset pagination. */
  onChange?: () => void;
  className?: string;
}

export function StreamingFilter({ filter, counts, onChange, className }: StreamingFilterProps) {
  const [open, setOpen] = useState(false);
  // "Available on" expands its options below it, inside the same popover.
  const [expanded, setExpanded] = useState(false);
  const { data: regions = [], isLoading: isLoadingRegions } = useWatchProviderRegions(open);

  const { selection, availableBrands, region, defaultRegion, regionOverride } = filter;
  const selectedIds = Object.keys(selection);

  const visibleBrands = useMemo(
    () => (counts ? availableBrands.filter(({ brand }) => (counts[brand.id] ?? 0) > 0 || brand.id in selection) : availableBrands),
    [availableBrands, counts, selection],
  );

  const regionName = (code: string | undefined) =>
    regions.find((entry) => entry.iso_3166_1 === code)?.english_name ?? code ?? "";

  const update = (next: StreamingSelection) => {
    filter.setSelection(next);
    onChange?.();
  };

  const toggleBrand = (brandId: string, checked: boolean) => {
    const next = { ...selection };
    if (checked) next[brandId] = null;
    else delete next[brandId];
    update(next);
  };

  // Picked offers narrow the brand; none picked means any way to watch.
  const setOffers = (brandId: string, offers: OfferType[]) => {
    update({ ...selection, [brandId]: offers.length > 0 ? offers : null });
  };

  const handleRegionChange = (value: string) => {
    filter.setRegionOverride(value === DEFAULT_REGION_VALUE ? null : value);
    onChange?.();
  };

  const handleClear = () => {
    filter.clear();
    onChange?.();
  };

  const isApplied = filter.isActive;
  const summary = !isApplied
    ? "Any"
    : selectedIds.length === 1
      ? getBrandName(selectedIds[0])
      : `${getBrandName(selectedIds[0])} +${selectedIds.length - 1}`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setExpanded(false);
  };

  const triggerButton = (
    <button
      type="button"
      aria-label={isApplied ? `Filters (${selectedIds.length} active)` : "Filters"}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-input/30 text-muted-foreground shadow-xs outline-none transition-[color,box-shadow,background-color] hover:bg-input/50 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] data-[state=open]:bg-input/50 data-[state=open]:text-foreground",
        isApplied && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary data-[state=open]:text-primary",
        className,
      )}
    >
      <ListFilter className="size-4" />
      {isApplied && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {selectedIds.length}
        </span>
      )}
    </button>
  );

  // flex-1 so the summary sits right next to the chevron that follows it.
  const availableOnLabel = (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span>Available on</span>
      <span className={cn("ml-auto max-w-[6.5rem] truncate text-xs", isApplied ? "text-primary" : "text-muted-foreground")}>
        {summary}
        {regionOverride && ` · ${regionOverride}`}
      </span>
    </span>
  );

  const panel = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-y px-3 py-2">
        <span className="text-xs text-muted-foreground">Region</span>
        <Select value={regionOverride ?? DEFAULT_REGION_VALUE} onValueChange={handleRegionChange}>
          <SelectTrigger size="sm" className="h-8 max-w-[11rem] text-xs" aria-label="Streaming region">
            <SelectValue>{regionOverride ? regionName(regionOverride) : `Default · ${defaultRegion ?? "…"}`}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={DEFAULT_REGION_VALUE}>Default ({regionName(defaultRegion)})</SelectItem>
            <SelectSeparator />
            {isLoadingRegions && <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading regions…</div>}
            {regions.map((entry) => (
              <SelectItem key={entry.iso_3166_1} value={entry.iso_3166_1}>
                {entry.english_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="p-2">
          {filter.isLoadingProviders ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="m-1 h-9 rounded-md" />)
          ) : visibleBrands.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              {counts ? "None of these titles are on a supported service in" : "No supported services in"} {regionName(region)}.
            </p>
          ) : (
            visibleBrands.map(({ brand, offers, logoPath }) => {
              const checked = brand.id in selection;
              const selectedOffers = selection[brand.id] ?? [];
              const showOffers = checked && offers.length > 1;
              const checkboxId = `streaming-${brand.id}`;
              return (
                <div
                  key={brand.id}
                  className={cn(
                    "rounded-lg border border-transparent transition-colors",
                    checked ? "border-primary/25 bg-primary/[0.06]" : "hover:bg-muted/50",
                    showOffers && "mb-1",
                  )}
                >
                  <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-3 px-2.5 py-2">
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(value) => toggleBrand(brand.id, value === true)}
                    />
                    {logoPath ? (
                      <img src={`${TMDB_LOGO_BASE}${logoPath}`} alt="" className="h-7 w-7 rounded-md shadow-sm" loading="lazy" />
                    ) : (
                      <span className="h-7 w-7 rounded-md bg-muted" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("truncate text-sm", checked && "font-medium")}>{brand.name}</span>
                      {showOffers && (
                        <span className="text-[11px] leading-tight text-muted-foreground">
                          {describeOffers(selection[brand.id])}
                        </span>
                      )}
                    </span>
                    {counts && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {counts[brand.id] ?? 0}
                      </span>
                    )}
                  </label>
                  {showOffers && (
                    <div className="px-2.5 pb-2.5 pl-[3.25rem]">
                      <ToggleGroup
                        type="multiple"
                        value={selectedOffers}
                        onValueChange={(value) => setOffers(brand.id, value as OfferType[])}
                        className="grid w-full grid-cols-3 gap-0.5 rounded-lg border border-border/70 bg-background/70 p-0.5"
                        aria-label={`${brand.name} offer types`}
                      >
                        {OFFER_TYPES.filter((offer) => offers.includes(offer)).map((offer) => {
                          const isOn = selectedOffers.includes(offer);
                          return (
                            <ToggleGroupItem
                              key={offer}
                              value={offer}
                              className={cn(
                                "h-7 gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                                "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary/90",
                              )}
                            >
                              <Check
                                className={cn(
                                  "size-3 transition-all duration-150",
                                  isOn ? "w-3 opacity-100" : "w-0 opacity-0",
                                )}
                              />
                              {OFFER_LABELS[offer]}
                            </ToggleGroupItem>
                          );
                        })}
                      </ToggleGroup>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t p-3">
        <span className="text-[11px] text-muted-foreground">
          Data by{" "}
          <a href="https://www.justwatch.com" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            JustWatch
          </a>
        </span>
        <Button variant="ghost" size="sm" onClick={handleClear} disabled={!filter.isActive && !regionOverride}>
          Clear
        </Button>
      </div>
    </>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        // Right-aligned under the button so it opens inward, not off the edge.
        align="end"
        collisionPadding={16}
        className={cn(
          "flex max-h-[min(36rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0 transition-[width] duration-200",
          expanded ? "w-[min(22rem,calc(100vw-2rem))]" : "w-64",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full shrink-0 items-center gap-2 px-3 py-2.5 text-sm outline-none hover:bg-accent/60 focus-visible:bg-accent/60"
        >
          {availableOnLabel}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} />
        </button>
        {expanded && panel}
      </PopoverContent>
    </Popover>
  );
}
