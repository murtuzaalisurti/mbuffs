import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  /** When set, the filter can't apply here and the popover explains why. */
  disabledReason?: string | null;
  /** Called after any change, e.g. to reset pagination. */
  onChange?: () => void;
  className?: string;
}

export function StreamingFilter({ filter, counts, disabledReason, onChange, className }: StreamingFilterProps) {
  const [open, setOpen] = useState(false);
  const { data: regions = [], isLoading: isLoadingRegions } = useWatchProviderRegions(open && !disabledReason);

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

  const isApplied = filter.isActive && !disabledReason;
  const triggerLabel = !isApplied
    ? "Streaming"
    : selectedIds.length === 1
      ? getBrandName(selectedIds[0])
      : `${getBrandName(selectedIds[0])} +${selectedIds.length - 1}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by streaming service"
          className={cn(
            // Mirrors SelectTrigger so it sits naturally next to the other selects.
            "group border-input bg-input/30 hover:bg-input/50 flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            isApplied && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
            className,
          )}
        >
          <span className="truncate max-w-[180px]">{triggerLabel}</span>
          <span className="flex items-center gap-1.5">
            {regionOverride && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                {regionOverride}
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180",
                isApplied && "opacity-80",
              )}
            />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        {disabledReason ? (
          <p className="p-4 text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b p-3">
              <span className="text-sm font-medium">Where to watch</span>
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

            <ScrollArea className="max-h-[min(60vh,24rem)]">
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
                              className="grid w-full grid-cols-3 gap-0.5 rounded-lg bg-muted/70 p-0.5"
                              aria-label={`${brand.name} offer types`}
                            >
                              {OFFER_TYPES.filter((offer) => offers.includes(offer)).map((offer) => {
                                const isOn = selectedOffers.includes(offer);
                                return (
                                  <ToggleGroupItem
                                    key={offer}
                                    value={offer}
                                    className={cn(
                                      "h-7 gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground",
                                      "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
                                    )}
                                  >
                                    <Check
                                      className={cn(
                                        "size-3 transition-all duration-150",
                                        isOn ? "w-3 opacity-100 text-primary" : "w-0 opacity-0",
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
            </ScrollArea>

            <div className="flex items-center justify-between gap-3 border-t p-3">
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
        )}
      </PopoverContent>
    </Popover>
  );
}
