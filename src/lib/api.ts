
import { Movie, MovieDetails, SearchResults } from './types';

// Normally we'd store this in an environment variable or secure location
const API_KEY = 'YOUR_TMDB_API_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// For demo purposes, we're using a placeholder key
// In a real app, you would use a proper API key from TMDB
const DEMO_MODE = true;

// Mock data for demo purposes
const MOCK_POPULAR_MOVIES: Movie[] = [
  {
    id: 1,
    title: "Inception",
    poster_path: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    release_date: "2010-07-16",
    vote_average: 8.4,
    overview: "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible."
  },
  {
    id: 2,
    title: "The Shawshank Redemption",
    poster_path: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
    release_date: "1994-09-23",
    vote_average: 8.7,
    overview: "Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden."
  },
  {
    id: 3,
    title: "The Dark Knight",
    poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    release_date: "2008-07-18",
    vote_average: 8.5,
    overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets."
  },
  {
    id: 4,
    title: "Pulp Fiction",
    poster_path: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    release_date: "1994-09-10",
    vote_average: 8.5,
    overview: "A burger-loving hit man, his philosophical partner, a drug-addled gangster's moll and a washed-up boxer converge in this sprawling, comedic crime caper."
  },
  {
    id: 5,
    title: "The Lord of the Rings: The Return of the King",
    poster_path: "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
    release_date: "2003-12-01",
    vote_average: 8.5,
    overview: "Aragorn is revealed as the heir to the ancient kings as he, Gandalf and the other members of the broken fellowship struggle to save Gondor from Sauron's forces."
  },
  {
    id: 6,
    title: "Fight Club",
    poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    release_date: "1999-10-15",
    vote_average: 8.4,
    overview: "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy."
  }
];

const MOCK_SEARCH_RESULTS: SearchResults = {
  page: 1,
  results: MOCK_POPULAR_MOVIES,
  total_pages: 1,
  total_results: MOCK_POPULAR_MOVIES.length
};

export const getImageUrl = (path: string, size = 'w500') => {
  if (!path) return '/placeholder.svg';
  if (DEMO_MODE) return `https://image.tmdb.org/t/p/${size}${path}`;
  return `${IMAGE_BASE_URL}/${size}${path}`;
};

export const fetchPopularMovies = async (): Promise<Movie[]> => {
  if (DEMO_MODE) {
    return Promise.resolve(MOCK_POPULAR_MOVIES);
  }

  try {
    const response = await fetch(
      `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`
    );
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return [];
  }
};

export const fetchMovieDetails = async (id: number): Promise<MovieDetails | null> => {
  if (DEMO_MODE) {
    const movie = MOCK_POPULAR_MOVIES.find(m => m.id === id);
    if (!movie) return null;
    
    return {
      ...movie,
      genres: [{ id: 1, name: 'Action' }, { id: 2, name: 'Sci-Fi' }],
      runtime: 148,
      tagline: 'Your mind is the scene of the crime.'
    };
  }
  
  try {
    const response = await fetch(
      `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching movie details:', error);
    return null;
  }
};

export const searchMovies = async (query: string): Promise<SearchResults> => {
  if (DEMO_MODE) {
    const filteredMovies = MOCK_POPULAR_MOVIES.filter(movie => 
      movie.title.toLowerCase().includes(query.toLowerCase())
    );
    
    return {
      page: 1,
      results: filteredMovies,
      total_pages: 1,
      total_results: filteredMovies.length
    };
  }

  try {
    const response = await fetch(
      `${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching movies:', error);
    return { page: 0, results: [], total_pages: 0, total_results: 0 };
  }
};
