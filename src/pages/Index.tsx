import { useQuery } from '@tanstack/react-query';
import { MovieGrid } from "@/components/MovieGrid";
import { fetchRecentContentApi, fetchUserRegion } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Skeleton } from '@/components/ui/skeleton';

const RECENT_CONTENT_QUERY_KEY = ['content', 'upcoming'];

const Index = () => {
  // Fetch user's region via IP for accurate location detection
  const { data: userRegion } = useQuery({
    queryKey: ['userRegion'],
    queryFn: fetchUserRegion,
    staleTime: Infinity, // Region unlikely to change in session
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const {
    data: recentContentData,
    isLoading: isRecentContentLoading,
  } = useQuery({
    queryKey: [RECENT_CONTENT_QUERY_KEY, userRegion],
    queryFn: () => fetchRecentContentApi(1, userRegion as string, timezone),
    enabled: !!userRegion,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes to reduce API calls
  });

  const recentContent = recentContentData?.results?.slice(0, 10) || [];

  return (
    <>
      <Navbar />
      <main className="container py-6 md:py-10">
        {/* Hero Section */}
        <section className="relative mb-12 md:mb-16">
          {/* Subtle gradient orb behind the text */}
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/[0.06] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-10 left-40 w-48 h-48 bg-purple-500/[0.04] rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-4">
              A place for your
              <br />
              <span className="text-gradient">movie buffs.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-md">
              Watch, Add, Share.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <div className="space-y-16">
            {/* Recent Content */}
            {isRecentContentLoading ? (
               <div className="space-y-6">
                 <Skeleton className="h-7 w-48 rounded-lg" />
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                   {Array.from({ length: 5 }).map((_, index) => (
                     <div key={index} className="space-y-3">
                       <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                       <Skeleton className="h-4 w-[75%] rounded-md" />
                       <Skeleton className="h-3 w-[45%] rounded-md" />
                     </div>
                   ))}
                 </div>
               </div>
            ) : recentContent.length > 0 && (
                <MovieGrid
                    movies={recentContent}
                    title="Recent"
                />
            )}
        </div>
      </main>
    </>
  );
};

export default Index;
