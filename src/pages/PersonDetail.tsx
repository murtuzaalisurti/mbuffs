import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPersonDetailsApi, fetchPersonCreditsApi, fetchPersonExternalIdsApi, getImageUrl } from '@/lib/api';
import { PersonDetails, PersonCreditsResponse, PersonCredit, PersonExternalIds } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Skeleton } from '@/components/ui/skeleton';
import { SocialMediaLinks } from '@/components/SocialMediaLinks';
import { User, Star, ImageOff, ChevronRight } from 'lucide-react';
import { useState, useRef } from 'react';

const BIO_CHAR_LIMIT_MOBILE = 150;
const BIO_CHAR_LIMIT_DESKTOP = 300;

export default function PersonDetail() {
    const { personId } = useParams<{ personId: string }>();
    const [bioExpanded, setBioExpanded] = useState(false);
    const castScrollRef = useRef<HTMLDivElement>(null);
    const crewScrollRef = useRef<HTMLDivElement>(null);

    const scrollRight = (ref: React.RefObject<HTMLDivElement | null>) => {
        if (ref.current) {
            ref.current.scrollBy({ left: 200, behavior: 'smooth' });
        }
    };

    const { data: personDetails, isLoading: isLoadingDetails, error } = useQuery<PersonDetails | null>({
        queryKey: ['person', personId],
        queryFn: () => fetchPersonDetailsApi(Number(personId)),
        enabled: !!personId,
    });

    const { data: creditsData, isLoading: isLoadingCredits } = useQuery<PersonCreditsResponse | null>({
        queryKey: ['personCredits', personId],
        queryFn: () => fetchPersonCreditsApi(Number(personId)),
        enabled: !!personId,
    });

    const { data: externalIds } = useQuery<PersonExternalIds | null>({
        queryKey: ['personExternalIds', personId],
        queryFn: () => fetchPersonExternalIdsApi(Number(personId)),
        enabled: !!personId,
    });

    const isLoading = isLoadingDetails || isLoadingCredits;

    // Calculate age or years lived
    const calculateAge = (birthday: string | null, deathday: string | null) => {
        if (!birthday) return null;
        const birth = new Date(birthday);
        const end = deathday ? new Date(deathday) : new Date();
        let age = end.getFullYear() - birth.getFullYear();
        const monthDiff = end.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (isLoading) {
        return (
            <>
                <Navbar />
                <main className="container pt-24 pb-12">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
                            <Skeleton className="w-full aspect-2/3 rounded-xl" />
                        </div>
                        <div className="grow space-y-4">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    </div>
                </main>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Navbar />
                <main className="container py-20 text-center">
                    <div className="rounded-2xl bg-red-500/5 border border-red-500/10 p-8 max-w-lg mx-auto">
                        <p className="text-red-500 font-medium">Error loading person details</p>
                    </div>
                </main>
            </>
        );
    }

    if (!personDetails) {
        return (
            <>
                <Navbar />
                <main className="container py-20 text-center text-muted-foreground">
                    Person not found.
                </main>
            </>
        );
    }

    const age = calculateAge(personDetails.birthday, personDetails.deathday);

    // Sort by vote_average, but only consider titles with 1000+ votes for quality filtering
    const sortByRating = (a: PersonCredit, b: PersonCredit) => {
        const aQualifies = (a.vote_count || 0) >= 1000;
        const bQualifies = (b.vote_count || 0) >= 1000;
        
        // Prioritize titles with 1000+ votes
        if (aQualifies && !bQualifies) return -1;
        if (!aQualifies && bQualifies) return 1;
        
        // Both qualify or both don't - sort by vote_average
        return (b.vote_average || 0) - (a.vote_average || 0);
    };

    // Deduplicate cast credits by ID (same show can appear multiple times for different episodes/characters)
    const castCreditsMap = new Map<number, PersonCredit>();
    creditsData?.cast?.forEach((c: PersonCredit) => {
        if (!c.poster_path) return;
        // Keep the entry with higher vote_count
        if (!castCreditsMap.has(c.id) || (c.vote_count || 0) > (castCreditsMap.get(c.id)?.vote_count || 0)) {
            castCreditsMap.set(c.id, c);
        }
    });
    const castCredits = Array.from(castCreditsMap.values())
        .sort(sortByRating)
        .slice(0, 20);

    // Deduplicate crew credits by ID
    const crewCreditsMap = new Map<number, PersonCredit & { jobs: string[] }>();
    creditsData?.crew?.forEach((c: PersonCredit) => {
        if (!c.poster_path) return;
        if (!crewCreditsMap.has(c.id)) {
            crewCreditsMap.set(c.id, { ...c, jobs: [c.job || ''] });
        } else {
            const existing = crewCreditsMap.get(c.id)!;
            if (c.job && !existing.jobs.includes(c.job)) {
                existing.jobs.push(c.job);
            }
        }
    });
    const crewCredits = Array.from(crewCreditsMap.values())
        .sort(sortByRating)
        .slice(0, 20);

    return (
        <>
            <Navbar />

            <main className="container pt-20 md:pt-24 pb-12">
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                    {/* Mobile: Horizontal layout with small image */}
                    <div className="flex md:hidden gap-4 items-start">
                        <div className="w-24 shrink-0">
                            <div className="rounded-lg overflow-hidden shadow-xl shadow-black/50 border border-white/8">
                                {personDetails.profile_path ? (
                                    <img
                                        src={getImageUrl(personDetails.profile_path, 'w185')}
                                        alt={personDetails.name}
                                        className="w-full h-auto aspect-2/3 object-cover bg-muted"
                                    />
                                ) : (
                                    <div className="w-full aspect-2/3 bg-muted/30 flex items-center justify-center">
                                        <User className="w-8 h-8 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grow space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">{personDetails.name}</h1>
                            <p className="text-sm text-muted-foreground">{personDetails.known_for_department}</p>
                            {/* Compact details for mobile */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-2">
                                {personDetails.birthday && (
                                    <div>
                                        <span className="text-muted-foreground">Born: </span>
                                        <span className="text-foreground">
                                            {formatDate(personDetails.birthday)}
                                            {age !== null && !personDetails.deathday && ` (${age})`}
                                        </span>
                                    </div>
                                )}
                                {personDetails.deathday && (
                                    <div>
                                        <span className="text-muted-foreground">Died: </span>
                                        <span className="text-foreground">
                                            {formatDate(personDetails.deathday)} ({age})
                                        </span>
                                    </div>
                                )}
                            </div>
                            {personDetails.place_of_birth && (
                                <p className="text-xs text-foreground/70">{personDetails.place_of_birth}</p>
                            )}
                            {/* Social Media Links - Mobile */}
                            <SocialMediaLinks externalIds={externalIds || null} className="pt-2" />
                        </div>
                    </div>

                    {/* Desktop: Profile Image */}
                    <div className="hidden md:block w-64 shrink-0">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/8">
                            {personDetails.profile_path ? (
                                <img
                                    src={getImageUrl(personDetails.profile_path, 'w500')}
                                    alt={personDetails.name}
                                    className="w-full h-auto aspect-2/3 object-cover bg-muted"
                                />
                            ) : (
                                <div className="w-full aspect-2/3 bg-muted/30 flex items-center justify-center">
                                    <User className="w-16 h-16 text-muted-foreground/30" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop: Details */}
                    <div className="hidden md:block grow space-y-6 text-left">
                        <div className="space-y-2">
                            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">{personDetails.name}</h1>
                            <p className="text-lg text-muted-foreground">{personDetails.known_for_department}</p>
                        </div>

                        {/* Personal Details - inline with separators */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            {personDetails.birthday && (
                                <>
                                    <span>
                                        Born {formatDate(personDetails.birthday)}
                                        {age !== null && !personDetails.deathday && ` (age ${age})`}
                                    </span>
                                </>
                            )}
                            {personDetails.deathday && (
                                <>
                                    <span className="text-white/20">|</span>
                                    <span>
                                        Died {formatDate(personDetails.deathday)}
                                        {age !== null && ` (age ${age})`}
                                    </span>
                                </>
                            )}
                            {personDetails.place_of_birth && (
                                <>
                                    <span className="text-white/20">|</span>
                                    <span>{personDetails.place_of_birth}</span>
                                </>
                            )}
                        </div>

                        {/* Social Media Links */}
                        <SocialMediaLinks externalIds={externalIds || null} />

                        {/* Biography - Desktop only in header */}
                        {personDetails.biography && (
                            <div className="space-y-2">
                                <p className="text-base leading-relaxed text-foreground/80 max-w-3xl">
                                    {personDetails.biography.length > BIO_CHAR_LIMIT_DESKTOP && !bioExpanded
                                        ? personDetails.biography.slice(0, BIO_CHAR_LIMIT_DESKTOP).trimEnd() + '...'
                                        : personDetails.biography}
                                </p>
                                {personDetails.biography.length > BIO_CHAR_LIMIT_DESKTOP && (
                                    <button
                                        onClick={() => setBioExpanded(!bioExpanded)}
                                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {bioExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile: Biography below header */}
                {personDetails.biography && (
                    <div className="md:hidden mt-4 space-y-2">
                        <p className="text-sm leading-relaxed text-foreground/80">
                            {personDetails.biography.length > BIO_CHAR_LIMIT_MOBILE && !bioExpanded
                                ? personDetails.biography.slice(0, BIO_CHAR_LIMIT_MOBILE).trimEnd() + '...'
                                : personDetails.biography}
                        </p>
                        {personDetails.biography.length > BIO_CHAR_LIMIT_MOBILE && (
                            <button
                                onClick={() => setBioExpanded(!bioExpanded)}
                                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {bioExpanded ? 'Show less' : 'Read more'}
                            </button>
                        )}
                    </div>
                )}

                {/* Filmography Sections */}
                <div className="mt-12 space-y-12">
                    {/* Acting Credits - only show if they have acting credits */}
                    {castCredits.length > 0 && (
                        <section className="space-y-6">
                            <h2 className="text-xl md:text-2xl font-semibold text-foreground/90">Known For</h2>
                            {/* Mobile: horizontal scroll */}
                            <div className="md:hidden relative -mx-4">
                                <div
                                    ref={castScrollRef}
                                    className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-hide px-4 pr-16"
                                >
                                    {castCredits.map((credit: PersonCredit) => (
                                        <Link
                                            key={`${credit.id}-${credit.character}`}
                                            to={`/media/${credit.media_type}/${credit.id}`}
                                            className="shrink-0 w-32 snap-center group"
                                        >
                                            <div className="rounded-lg overflow-hidden border border-white/8 bg-muted/30 mb-2 aspect-2/3 relative">
                                                {credit.poster_path ? (
                                                    <img
                                                        src={getImageUrl(credit.poster_path, 'w342')}
                                                        alt={credit.title || credit.name}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageOff className="w-8 h-8 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {credit.vote_average > 0 && (
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs">
                                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                        <span>{credit.vote_average.toFixed(1)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-foreground/90 line-clamp-1">{credit.title || credit.name}</p>
                                            {credit.character && (
                                                <p className="text-xs text-muted-foreground line-clamp-1">as {credit.character}</p>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                                <button
                                    onClick={() => scrollRight(castScrollRef)}
                                    className="absolute right-0 top-0 bottom-4 w-16 flex items-center justify-center bg-linear-to-l from-background via-background/80 to-transparent"
                                    aria-label="Scroll right"
                                >
                                    <ChevronRight className="w-5 h-5 text-foreground/60" />
                                </button>
                            </div>
                            {/* Desktop: grid */}
                            <div className="hidden md:grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                {castCredits.map((credit: PersonCredit) => (
                                    <Link
                                        key={`${credit.id}-${credit.character}`}
                                        to={`/media/${credit.media_type}/${credit.id}`}
                                        className="group"
                                    >
                                        <div className="rounded-lg overflow-hidden border border-white/8 bg-muted/30 mb-2 aspect-2/3 relative">
                                            {credit.poster_path ? (
                                                <img
                                                    src={getImageUrl(credit.poster_path, 'w342')}
                                                    alt={credit.title || credit.name}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageOff className="w-8 h-8 text-muted-foreground/30" />
                                                </div>
                                            )}
                                            {credit.vote_average > 0 && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs">
                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                    <span>{credit.vote_average.toFixed(1)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-foreground/90 line-clamp-1">{credit.title || credit.name}</p>
                                        {credit.character && (
                                            <p className="text-xs text-muted-foreground line-clamp-1">as {credit.character}</p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Crew Credits - only show if they have crew credits AND are not primarily an actor (to avoid duplicate sections) */}
                    {crewCredits.length > 0 && personDetails.known_for_department !== 'Acting' && (
                        <section className="space-y-6">
                            <h2 className="text-xl md:text-2xl font-semibold text-foreground/90">Also Known For</h2>
                            {/* Mobile: horizontal scroll */}
                            <div className="md:hidden relative -mx-4">
                                <div
                                    ref={crewScrollRef}
                                    className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-hide px-4 pr-16"
                                >
                                    {crewCredits.map((credit) => (
                                        <Link
                                            key={`${credit.id}-${credit.jobs.join('-')}`}
                                            to={`/media/${credit.media_type}/${credit.id}`}
                                            className="shrink-0 w-32 snap-center group"
                                        >
                                            <div className="rounded-lg overflow-hidden border border-white/8 bg-muted/30 mb-2 aspect-2/3 relative">
                                                {credit.poster_path ? (
                                                    <img
                                                        src={getImageUrl(credit.poster_path, 'w342')}
                                                        alt={credit.title || credit.name}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageOff className="w-8 h-8 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {credit.vote_average > 0 && (
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs">
                                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                        <span>{credit.vote_average.toFixed(1)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-foreground/90 line-clamp-1">{credit.title || credit.name}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{credit.jobs.join(', ')}</p>
                                        </Link>
                                    ))}
                                </div>
                                <button
                                    onClick={() => scrollRight(crewScrollRef)}
                                    className="absolute right-0 top-0 bottom-4 w-16 flex items-center justify-center bg-linear-to-l from-background via-background/80 to-transparent"
                                    aria-label="Scroll right"
                                >
                                    <ChevronRight className="w-5 h-5 text-foreground/60" />
                                </button>
                            </div>
                            {/* Desktop: grid */}
                            <div className="hidden md:grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                {crewCredits.map((credit) => (
                                    <Link
                                        key={`${credit.id}-${credit.jobs.join('-')}`}
                                        to={`/media/${credit.media_type}/${credit.id}`}
                                        className="group"
                                    >
                                        <div className="rounded-lg overflow-hidden border border-white/8 bg-muted/30 mb-2 aspect-2/3 relative">
                                            {credit.poster_path ? (
                                                <img
                                                    src={getImageUrl(credit.poster_path, 'w342')}
                                                    alt={credit.title || credit.name}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageOff className="w-8 h-8 text-muted-foreground/30" />
                                                </div>
                                            )}
                                            {credit.vote_average > 0 && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs">
                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                    <span>{credit.vote_average.toFixed(1)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-foreground/90 line-clamp-1">{credit.title || credit.name}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{credit.jobs.join(', ')}</p>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </>
    );
}
