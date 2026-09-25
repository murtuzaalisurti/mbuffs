import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Star, User } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import { searchMultiApi, getImageUrl } from '@/lib/api';
import { MultiSearchResult, PersonSearchResult } from '@/lib/types';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global search palette (Cmd/Ctrl+K). Lives in its own module so the Navbar can
 * lazy-load it (and cmdk) the first time search is opened.
 */
const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const normalizedSearch = debouncedSearch.trim().toLowerCase();

  const { data: searchResultsData, isLoading: isSearching } = useQuery({
    queryKey: ['multi-search', 'navbar', normalizedSearch],
    queryFn: () => searchMultiApi(normalizedSearch),
    enabled: !!normalizedSearch && open,
    staleTime: 1000 * 60 * 5,
  });

  const rawSearchResults = (searchResultsData?.results ?? []).filter(
    (result): result is MultiSearchResult =>
      result.media_type === 'movie' ||
      result.media_type === 'tv' ||
      result.media_type === 'person'
  );

  const searchResults = useMemo(() => {
    const dedupedResults: MultiSearchResult[] = [];
    const personIndexByName = new Map<string, number>();
    const isPersonResult = (result: MultiSearchResult): result is PersonSearchResult => result.media_type === 'person';
    const isMediaResult = (
      result: MultiSearchResult
    ): result is Extract<MultiSearchResult, { media_type: 'movie' | 'tv' }> =>
      result.media_type === 'movie' || result.media_type === 'tv';

    const getMediaScore = (result: Extract<MultiSearchResult, { media_type: 'movie' | 'tv' }>) => {
      const voteAverage = result.vote_average ?? 0;
      const voteCount = result.vote_count ?? 0;
      const popularity = result.popularity ?? 0;

      const normalizedRating = voteAverage / 10;
      const normalizedPopularity = Math.min(Math.log10(popularity + 1) / 3, 1);
      const ratingConfidence = Math.min(voteCount / 500, 1);
      const adjustedRating = normalizedRating * (0.6 + 0.4 * ratingConfidence);

      return adjustedRating * 0.7 + normalizedPopularity * 0.3;
    };

    for (const result of rawSearchResults) {
      if (result.media_type !== 'person') {
        dedupedResults.push(result);
        continue;
      }

      const personNameKey = result.name.trim().toLowerCase() || `person-${result.id}`;
      const existingIndex = personIndexByName.get(personNameKey);

      if (existingIndex === undefined) {
        dedupedResults.push({
          ...result,
          known_for: result.known_for ?? [],
        });
        personIndexByName.set(personNameKey, dedupedResults.length - 1);
        continue;
      }

      const existingPerson = dedupedResults[existingIndex] as PersonSearchResult;
      const existingKnownFor = existingPerson.known_for ?? [];
      const incomingKnownFor = result.known_for ?? [];
      const mergedKnownFor = [...existingKnownFor, ...incomingKnownFor];
      const uniqueKnownFor = Array.from(
        new Map(
          mergedKnownFor.map((credit) => {
            const mediaType = credit.first_air_date ? 'tv' : 'movie';
            return [`${mediaType}-${credit.id}`, credit];
          })
        ).values()
      );

      const mergedDepartments = Array.from(
        new Set([
          ...(existingPerson.known_for_department || '').split(' / ').map((department) => department.trim()).filter(Boolean),
          ...(result.known_for_department || '').split(' / ').map((department) => department.trim()).filter(Boolean),
        ])
      ).join(' / ');

      const keepIncomingAsPrimary = (result.popularity ?? 0) > (existingPerson.popularity ?? 0);

      dedupedResults[existingIndex] = {
        ...(keepIncomingAsPrimary ? result : existingPerson),
        media_type: 'person',
        name: existingPerson.name,
        profile_path: existingPerson.profile_path || result.profile_path,
        known_for_department: mergedDepartments || existingPerson.known_for_department || result.known_for_department,
        popularity: Math.max(existingPerson.popularity ?? 0, result.popularity ?? 0),
        known_for: uniqueKnownFor,
      };
    }

    const sortedPeople = dedupedResults
      .filter(isPersonResult)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

    const sortedMedia = dedupedResults
      .filter(isMediaResult)
      .sort((a, b) => {
        const scoreDiff = getMediaScore(b) - getMediaScore(a);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        const ratingDiff = (b.vote_average ?? 0) - (a.vote_average ?? 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        return (b.popularity ?? 0) - (a.popularity ?? 0);
      });

    let sortedPersonIndex = 0;
    let sortedMediaIndex = 0;

    return dedupedResults.map((result) => {
      if (isPersonResult(result)) {
        const sortedPerson = sortedPeople[sortedPersonIndex];
        sortedPersonIndex += 1;
        return sortedPerson ?? result;
      }

      const sortedMediaResult = sortedMedia[sortedMediaIndex];
      sortedMediaIndex += 1;
      return sortedMediaResult ?? result;
    });
  }, [rawSearchResults]);

  const handleSearchResultClick = (result: MultiSearchResult) => {
    onOpenChange(false);
    setSearchTerm('');

    if (result.media_type === 'person') {
      navigate(`/person/${result.id}`);
      return;
    }

    navigate(`/media/${result.media_type}/${result.id}`);
  };

  return (
        <CommandDialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) setSearchTerm(''); }}>
          <CommandInput
            placeholder="Search movies, shows & people..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            autoFocus
          />
          <CommandList className="max-h-[60vh] p-2">
            {!normalizedSearch && (
              <p className="text-sm text-muted-foreground text-center py-8">Start typing to search...</p>
            )}

            {isSearching && normalizedSearch && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {normalizedSearch && !isSearching && searchResults.length === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}

            {!isSearching && searchResults.length > 0 && (
              <CommandGroup heading="Results">
                {searchResults.map((result) => {
                  if (result.media_type === 'person') {
                    const knownForTitle = result.known_for
                      ?.map((credit) => credit.title || credit.name)
                      .filter((title): title is string => Boolean(title))
                      .slice(0, 2)
                      .join(', ');

                    return (
                      <CommandItem
                        key={`${result.media_type}-${result.id}`}
                        value={`${result.name} ${result.known_for_department || ''} ${knownForTitle || ''}`}
                        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer"
                        onSelect={() => handleSearchResultClick(result)}
                      >
                        {result.profile_path ? (
                          <img
                            src={getImageUrl(result.profile_path, 'w92')}
                            alt={result.name}
                            className="h-14 w-10 rounded-md object-cover bg-muted shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                          />
                        ) : (
                          <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="grow min-w-0">
                          <p className="text-sm font-medium truncate">{result.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="opacity-70">{result.known_for_department || 'Person'}</span>
                            {knownForTitle && <span className="truncate">{knownForTitle}</span>}
                            <Badge variant="secondary" className="text-[10px]">Person</Badge>
                          </div>
                        </div>
                      </CommandItem>
                    );
                  }

                  return (
                    <CommandItem
                      key={`${result.media_type}-${result.id}`}
                      value={`${result.name || result.title} ${result.first_air_date || result.release_date || ''}`}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer"
                      onSelect={() => handleSearchResultClick(result)}
                    >
                      <img
                        src={getImageUrl(result.poster_path, 'w92')}
                        alt={result.name || result.title}
                        className="h-14 w-10 rounded-md object-cover bg-muted shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                      />
                      <div className="grow min-w-0">
                        <p className="text-sm font-medium truncate">{result.name || result.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {(result.release_date || result.first_air_date) && (
                            <span>{new Date(result.first_air_date || result.release_date).getFullYear()}</span>
                          )}
                          {result.vote_average > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/85">
                              <Star className="!h-2.5 !w-2.5 shrink-0 fill-amber-500/85 text-amber-500/85" strokeWidth={1.75} />
                              <span>{result.vote_average.toFixed(1)}</span>
                            </span>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {result.media_type === 'tv' ? 'TV Show' : 'Movie'}
                          </Badge>
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
  );
};

export default SearchDialog;
