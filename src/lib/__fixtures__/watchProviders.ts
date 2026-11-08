// Trimmed real TMDB responses (captured 2026-11-08) used by streamingProviders tests.
// Region lists come from /watch/providers/{movie,tv}?watch_region=, limited to the
// providers the brand map uses plus a few unrelated ones; titles come from
// /{type}/{id}/watch/providers for IN, US and GB.
import type { WatchProvider, WatchProvidersResult } from '../types';

export const REGION_PROVIDERS: Record<string, WatchProvider[]> = {
  "IN": [
    {
      "provider_id": 8,
      "provider_name": "Netflix",
      "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
      "display_priority": 0
    },
    {
      "provider_id": 119,
      "provider_name": "Amazon Prime Video",
      "logo_path": "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
      "display_priority": 2
    },
    {
      "provider_id": 350,
      "provider_name": "Apple TV",
      "logo_path": "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
      "display_priority": 3
    },
    {
      "provider_id": 2336,
      "provider_name": "JioHotstar",
      "logo_path": "/ledoS6EgdjTNq8F1e6wubUQer18.png",
      "display_priority": 4
    },
    {
      "provider_id": 2,
      "provider_name": "Apple TV Store",
      "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
      "display_priority": 5
    },
    {
      "provider_id": 283,
      "provider_name": "Crunchyroll",
      "logo_path": "/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png",
      "display_priority": 6
    },
    {
      "provider_id": 232,
      "provider_name": "Zee5",
      "logo_path": "/uQvhdtB8skccsGHmvKi3y5bqBsX.png",
      "display_priority": 7
    },
    {
      "provider_id": 11,
      "provider_name": "MUBI",
      "logo_path": "/k7iSlvgWzZuO4zU5PcBjhABMuia.png",
      "display_priority": 8
    },
    {
      "provider_id": 237,
      "provider_name": "Sony Liv",
      "logo_path": "/coM4QWbmIOa0xJ5cGR9BRmoV25B.png",
      "display_priority": 9
    },
    {
      "provider_id": 192,
      "provider_name": "YouTube",
      "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
      "display_priority": 10
    },
    {
      "provider_id": 175,
      "provider_name": "Netflix Kids",
      "logo_path": "/rjPaInWHH1nPgtRFF17BbHN2gu.png",
      "display_priority": 12
    },
    {
      "provider_id": 614,
      "provider_name": "VI movies and tv",
      "logo_path": "/9SVVjJ89csOM0xoeVVK8BryUf9a.png",
      "display_priority": 35
    },
    {
      "provider_id": 10,
      "provider_name": "Amazon Video",
      "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
      "display_priority": 38
    },
    {
      "provider_id": 1968,
      "provider_name": "Crunchyroll Amazon Channel",
      "logo_path": "/qHLLmKo7udRgiSnIASVTwP2IxfJ.png",
      "display_priority": 48
    },
    {
      "provider_id": 201,
      "provider_name": "MUBI Amazon Channel",
      "logo_path": "/w1hl8HszsPf5aAGT0mVY0O6LYP4.png",
      "display_priority": 57
    },
    {
      "provider_id": 2243,
      "provider_name": "Apple TV Amazon Channel",
      "logo_path": "/rerVCu9auZrgxTTiZu1criqrQzg.png",
      "display_priority": 64
    },
    {
      "provider_id": 2100,
      "provider_name": "Amazon Prime Video with Ads",
      "logo_path": "/tpwTT1FpWqLLhxUfAuDavIXDDfI.png",
      "display_priority": 69
    },
    {
      "provider_id": 613,
      "provider_name": "Amazon Prime Video Free with Ads",
      "logo_path": "/fuVBtr57kxnYzOILZ38xqSmBeyR.png",
      "display_priority": 91
    },
    {
      "provider_id": 2792,
      "provider_name": "Sonyliv Amazon Channel",
      "logo_path": "/944iNBWJZwKT1lfO3y2oEqquQjG.png",
      "display_priority": 95
    }
  ],
  "US": [
    {
      "provider_id": 8,
      "provider_name": "Netflix",
      "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
      "display_priority": 0
    },
    {
      "provider_id": 9,
      "provider_name": "Amazon Prime Video",
      "logo_path": "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
      "display_priority": 4
    },
    {
      "provider_id": 350,
      "provider_name": "Apple TV",
      "logo_path": "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
      "display_priority": 5
    },
    {
      "provider_id": 337,
      "provider_name": "Disney Plus",
      "logo_path": "/5eZ872CghnHFLB1j8grszbrx0dx.png",
      "display_priority": 6
    },
    {
      "provider_id": 15,
      "provider_name": "Hulu",
      "logo_path": "/44uAnmSqvA4yBOdbPWN8YgQHjWm.png",
      "display_priority": 7
    },
    {
      "provider_id": 10,
      "provider_name": "Amazon Video",
      "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
      "display_priority": 9
    },
    {
      "provider_id": 2,
      "provider_name": "Apple TV Store",
      "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
      "display_priority": 10
    },
    {
      "provider_id": 1825,
      "provider_name": "HBO Max Amazon Channel",
      "logo_path": "/64fLWeSyZ1KQZhIdvTdy4QHeWty.png",
      "display_priority": 13
    },
    {
      "provider_id": 283,
      "provider_name": "Crunchyroll",
      "logo_path": "/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png",
      "display_priority": 15
    },
    {
      "provider_id": 2303,
      "provider_name": "Paramount Plus Premium",
      "logo_path": "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png",
      "display_priority": 17
    },
    {
      "provider_id": 2616,
      "provider_name": "Paramount Plus Essential",
      "logo_path": "/uPWQPyF4nqwtfPNmGcFcenU57HG.png",
      "display_priority": 18
    },
    {
      "provider_id": 386,
      "provider_name": "Peacock Premium",
      "logo_path": "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png",
      "display_priority": 19
    },
    {
      "provider_id": 3,
      "provider_name": "Google Play Movies",
      "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
      "display_priority": 23
    },
    {
      "provider_id": 192,
      "provider_name": "YouTube",
      "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
      "display_priority": 24
    },
    {
      "provider_id": 1968,
      "provider_name": "Crunchyroll Amazon Channel",
      "logo_path": "/qHLLmKo7udRgiSnIASVTwP2IxfJ.png",
      "display_priority": 25
    },
    {
      "provider_id": 582,
      "provider_name": "Paramount+ Amazon Channel",
      "logo_path": "/bxX0YVOCY7bI85BKRlJAAQ2EjUR.png",
      "display_priority": 29
    },
    {
      "provider_id": 188,
      "provider_name": "YouTube Premium",
      "logo_path": "/eWHpKZihdiY617s5LipWJWvN28U.png",
      "display_priority": 36
    },
    {
      "provider_id": 11,
      "provider_name": "MUBI",
      "logo_path": "/k7iSlvgWzZuO4zU5PcBjhABMuia.png",
      "display_priority": 59
    },
    {
      "provider_id": 175,
      "provider_name": "Netflix Kids",
      "logo_path": "/rjPaInWHH1nPgtRFF17BbHN2gu.png",
      "display_priority": 62
    },
    {
      "provider_id": 201,
      "provider_name": "MUBI Amazon Channel",
      "logo_path": "/w1hl8HszsPf5aAGT0mVY0O6LYP4.png",
      "display_priority": 88
    },
    {
      "provider_id": 613,
      "provider_name": "Amazon Prime Video Free with Ads",
      "logo_path": "/fuVBtr57kxnYzOILZ38xqSmBeyR.png",
      "display_priority": 142
    },
    {
      "provider_id": 1796,
      "provider_name": "Netflix Standard with Ads",
      "logo_path": "/eGUwOOIxcazwEBxqJpSN5sWEu6V.png",
      "display_priority": 152
    },
    {
      "provider_id": 1899,
      "provider_name": "HBO Max",
      "logo_path": "/skypuy7SXuugIQeYg0IglmzoKaS.png",
      "display_priority": 153
    },
    {
      "provider_id": 2100,
      "provider_name": "Amazon Prime Video with Ads",
      "logo_path": "/tpwTT1FpWqLLhxUfAuDavIXDDfI.png",
      "display_priority": 202
    },
    {
      "provider_id": 387,
      "provider_name": "Peacock Premium Plus",
      "logo_path": "/yrEwyMzEKdqAoGhaWUARtIxByol.png",
      "display_priority": 214
    },
    {
      "provider_id": 2243,
      "provider_name": "Apple TV Amazon Channel",
      "logo_path": "/rerVCu9auZrgxTTiZu1criqrQzg.png",
      "display_priority": 216
    }
  ],
  "GB": [
    {
      "provider_id": 8,
      "provider_name": "Netflix",
      "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
      "display_priority": 1
    },
    {
      "provider_id": 9,
      "provider_name": "Amazon Prime Video",
      "logo_path": "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
      "display_priority": 2
    },
    {
      "provider_id": 350,
      "provider_name": "Apple TV",
      "logo_path": "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
      "display_priority": 3
    },
    {
      "provider_id": 337,
      "provider_name": "Disney Plus",
      "logo_path": "/5eZ872CghnHFLB1j8grszbrx0dx.png",
      "display_priority": 4
    },
    {
      "provider_id": 2,
      "provider_name": "Apple TV Store",
      "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
      "display_priority": 6
    },
    {
      "provider_id": 283,
      "provider_name": "Crunchyroll",
      "logo_path": "/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png",
      "display_priority": 8
    },
    {
      "provider_id": 10,
      "provider_name": "Amazon Video",
      "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
      "display_priority": 10
    },
    {
      "provider_id": 531,
      "provider_name": "Paramount Plus",
      "logo_path": "/pkx3klJlwW5JdtaulvDx6hDNtch.png",
      "display_priority": 11
    },
    {
      "provider_id": 1825,
      "provider_name": "HBO Max Amazon Channel",
      "logo_path": "/64fLWeSyZ1KQZhIdvTdy4QHeWty.png",
      "display_priority": 15
    },
    {
      "provider_id": 29,
      "provider_name": "Sky Go",
      "logo_path": "/1Yvl9eP3pmktqChitnFhHJHcBtX.png",
      "display_priority": 16
    },
    {
      "provider_id": 1968,
      "provider_name": "Crunchyroll Amazon Channel",
      "logo_path": "/qHLLmKo7udRgiSnIASVTwP2IxfJ.png",
      "display_priority": 17
    },
    {
      "provider_id": 11,
      "provider_name": "MUBI",
      "logo_path": "/k7iSlvgWzZuO4zU5PcBjhABMuia.png",
      "display_priority": 19
    },
    {
      "provider_id": 613,
      "provider_name": "Amazon Prime Video Free with Ads",
      "logo_path": "/fuVBtr57kxnYzOILZ38xqSmBeyR.png",
      "display_priority": 21
    },
    {
      "provider_id": 41,
      "provider_name": "ITVX",
      "logo_path": "/nIViE3wOPV5Jyv45T7hetHyG6iS.png",
      "display_priority": 24
    },
    {
      "provider_id": 192,
      "provider_name": "YouTube",
      "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
      "display_priority": 25
    },
    {
      "provider_id": 175,
      "provider_name": "Netflix Kids",
      "logo_path": "/rjPaInWHH1nPgtRFF17BbHN2gu.png",
      "display_priority": 32
    },
    {
      "provider_id": 188,
      "provider_name": "YouTube Premium",
      "logo_path": "/eWHpKZihdiY617s5LipWJWvN28U.png",
      "display_priority": 33
    },
    {
      "provider_id": 201,
      "provider_name": "MUBI Amazon Channel",
      "logo_path": "/w1hl8HszsPf5aAGT0mVY0O6LYP4.png",
      "display_priority": 39
    },
    {
      "provider_id": 582,
      "provider_name": "Paramount+ Amazon Channel",
      "logo_path": "/bxX0YVOCY7bI85BKRlJAAQ2EjUR.png",
      "display_priority": 75
    },
    {
      "provider_id": 1796,
      "provider_name": "Netflix Standard with Ads",
      "logo_path": "/eGUwOOIxcazwEBxqJpSN5sWEu6V.png",
      "display_priority": 86
    },
    {
      "provider_id": 2100,
      "provider_name": "Amazon Prime Video with Ads",
      "logo_path": "/tpwTT1FpWqLLhxUfAuDavIXDDfI.png",
      "display_priority": 98
    },
    {
      "provider_id": 2243,
      "provider_name": "Apple TV Amazon Channel",
      "logo_path": "/rerVCu9auZrgxTTiZu1criqrQzg.png",
      "display_priority": 118
    },
    {
      "provider_id": 2303,
      "provider_name": "Paramount Plus Premium",
      "logo_path": "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png",
      "display_priority": 119
    },
    {
      "provider_id": 1899,
      "provider_name": "HBO Max",
      "logo_path": "/skypuy7SXuugIQeYg0IglmzoKaS.png",
      "display_priority": 175
    }
  ]
};

export const TITLE_PROVIDERS: Record<string, Record<string, WatchProvidersResult>> = {
  "tv Severance": {
    "IN": {
      "flatrate": [
        {
          "provider_id": 350,
          "provider_name": "Apple TV",
          "logo_path": "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
          "display_priority": 3
        },
        {
          "provider_id": 2243,
          "provider_name": "Apple TV Amazon Channel",
          "logo_path": "/rerVCu9auZrgxTTiZu1criqrQzg.png",
          "display_priority": 64
        }
      ],
      "link": "https://www.themoviedb.org/tv/95396-severance/watch?locale=IN"
    },
    "US": {
      "flatrate": [
        {
          "provider_id": 350,
          "provider_name": "Apple TV",
          "logo_path": "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
          "display_priority": 5
        },
        {
          "provider_id": 2243,
          "provider_name": "Apple TV Amazon Channel",
          "logo_path": "/rerVCu9auZrgxTTiZu1criqrQzg.png",
          "display_priority": 216
        }
      ],
      "link": "https://www.themoviedb.org/tv/95396-severance/watch?locale=US"
    },
    "GB": {
      "flatrate": [
        {
          "provider_id": 350,
          "provider_name": "Apple TV",
          "logo_path": "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
          "display_priority": 3
        },
        {
          "provider_id": 2243,
          "provider_name": "Apple TV Amazon Channel",
          "logo_path": "/rerVCu9auZrgxTTiZu1criqrQzg.png",
          "display_priority": 118
        }
      ],
      "link": "https://www.themoviedb.org/tv/95396-severance/watch?locale=GB"
    }
  },
  "movie Dune: Part Two": {
    "IN": {
      "flatrate": [
        {
          "provider_id": 8,
          "provider_name": "Netflix",
          "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
          "display_priority": 0
        }
      ],
      "buy": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 5
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 10
        }
      ],
      "rent": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 5
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 10
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 38
        }
      ],
      "link": "https://www.themoviedb.org/movie/693134-dune-part-two/watch?locale=IN"
    },
    "US": {
      "rent": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 24
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        },
        {
          "provider_id": 486,
          "provider_name": "Spectrum On Demand",
          "logo_path": "/6qPtM96UZkt3Bu4ZFPsDeHFWUZ2.png",
          "display_priority": 122
        },
        {
          "provider_id": 538,
          "provider_name": "Plex",
          "logo_path": "/blAEhvx3XX8sV0fFVFk88FFjubs.png",
          "display_priority": 127
        }
      ],
      "buy": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 24
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        }
      ],
      "flatrate": [
        {
          "provider_id": 1825,
          "provider_name": "HBO Max Amazon Channel",
          "logo_path": "/64fLWeSyZ1KQZhIdvTdy4QHeWty.png",
          "display_priority": 13
        },
        {
          "provider_id": 2528,
          "provider_name": "YouTube TV",
          "logo_path": "/48bVXEIyCLSL9pZUQ7gB9ToyWto.png",
          "display_priority": 41
        },
        {
          "provider_id": 506,
          "provider_name": "TBS",
          "logo_path": "/8MX4rbkjJUf2NMb2ZVwHq0IATJf.png",
          "display_priority": 118
        },
        {
          "provider_id": 1899,
          "provider_name": "HBO Max",
          "logo_path": "/skypuy7SXuugIQeYg0IglmzoKaS.png",
          "display_priority": 153
        }
      ],
      "link": "https://www.themoviedb.org/movie/693134-dune-part-two/watch?locale=US"
    },
    "GB": {
      "buy": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 35,
          "provider_name": "Rakuten TV",
          "logo_path": "/872dfVu1biZISJ8rO143CZZutPR.png",
          "display_priority": 7
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        },
        {
          "provider_id": 130,
          "provider_name": "Sky Store",
          "logo_path": "/nNkZ1JKe6vNhzti14KiKEUWHE6H.png",
          "display_priority": 20
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 25
        }
      ],
      "flatrate": [
        {
          "provider_id": 8,
          "provider_name": "Netflix",
          "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
          "display_priority": 1
        },
        {
          "provider_id": 1796,
          "provider_name": "Netflix Standard with Ads",
          "logo_path": "/eGUwOOIxcazwEBxqJpSN5sWEu6V.png",
          "display_priority": 86
        }
      ],
      "rent": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 35,
          "provider_name": "Rakuten TV",
          "logo_path": "/872dfVu1biZISJ8rO143CZZutPR.png",
          "display_priority": 7
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        }
      ],
      "link": "https://www.themoviedb.org/movie/693134-dune-part-two/watch?locale=GB"
    }
  },
  "tv One Piece": {
    "IN": {
      "flatrate": [
        {
          "provider_id": 283,
          "provider_name": "Crunchyroll",
          "logo_path": "/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png",
          "display_priority": 6
        },
        {
          "provider_id": 237,
          "provider_name": "Sony Liv",
          "logo_path": "/coM4QWbmIOa0xJ5cGR9BRmoV25B.png",
          "display_priority": 9
        },
        {
          "provider_id": 1968,
          "provider_name": "Crunchyroll Amazon Channel",
          "logo_path": "/qHLLmKo7udRgiSnIASVTwP2IxfJ.png",
          "display_priority": 48
        }
      ],
      "link": "https://www.themoviedb.org/tv/37854/watch?locale=IN"
    },
    "US": {
      "flatrate": [
        {
          "provider_id": 8,
          "provider_name": "Netflix",
          "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
          "display_priority": 0
        },
        {
          "provider_id": 15,
          "provider_name": "Hulu",
          "logo_path": "/44uAnmSqvA4yBOdbPWN8YgQHjWm.png",
          "display_priority": 7
        },
        {
          "provider_id": 283,
          "provider_name": "Crunchyroll",
          "logo_path": "/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png",
          "display_priority": 15
        },
        {
          "provider_id": 1968,
          "provider_name": "Crunchyroll Amazon Channel",
          "logo_path": "/qHLLmKo7udRgiSnIASVTwP2IxfJ.png",
          "display_priority": 25
        },
        {
          "provider_id": 1796,
          "provider_name": "Netflix Standard with Ads",
          "logo_path": "/eGUwOOIxcazwEBxqJpSN5sWEu6V.png",
          "display_priority": 152
        }
      ],
      "buy": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        }
      ],
      "link": "https://www.themoviedb.org/tv/37854/watch?locale=US"
    },
    "GB": {
      "flatrate": [
        {
          "provider_id": 8,
          "provider_name": "Netflix",
          "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
          "display_priority": 1
        },
        {
          "provider_id": 337,
          "provider_name": "Disney Plus",
          "logo_path": "/5eZ872CghnHFLB1j8grszbrx0dx.png",
          "display_priority": 4
        },
        {
          "provider_id": 283,
          "provider_name": "Crunchyroll",
          "logo_path": "/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png",
          "display_priority": 8
        },
        {
          "provider_id": 29,
          "provider_name": "Sky Go",
          "logo_path": "/1Yvl9eP3pmktqChitnFhHJHcBtX.png",
          "display_priority": 16
        },
        {
          "provider_id": 1968,
          "provider_name": "Crunchyroll Amazon Channel",
          "logo_path": "/qHLLmKo7udRgiSnIASVTwP2IxfJ.png",
          "display_priority": 17
        },
        {
          "provider_id": 1796,
          "provider_name": "Netflix Standard with Ads",
          "logo_path": "/eGUwOOIxcazwEBxqJpSN5sWEu6V.png",
          "display_priority": 86
        }
      ],
      "free": [
        {
          "provider_id": 38,
          "provider_name": "BBC iPlayer",
          "logo_path": "/vi6XJCpJ9GpAPD3rDSRzMC812Z.png",
          "display_priority": 18
        }
      ],
      "link": "https://www.themoviedb.org/tv/37854/watch?locale=GB"
    }
  },
  "movie Oppenheimer": {
    "IN": {
      "buy": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 5
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 10
        }
      ],
      "rent": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 5
        },
        {
          "provider_id": 232,
          "provider_name": "Zee5",
          "logo_path": "/uQvhdtB8skccsGHmvKi3y5bqBsX.png",
          "display_priority": 7
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 10
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 38
        }
      ],
      "flatrate": [
        {
          "provider_id": 2336,
          "provider_name": "JioHotstar",
          "logo_path": "/ledoS6EgdjTNq8F1e6wubUQer18.png",
          "display_priority": 4
        }
      ],
      "link": "https://www.themoviedb.org/movie/872585-oppenheimer/watch?locale=IN"
    },
    "US": {
      "rent": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 24
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        },
        {
          "provider_id": 486,
          "provider_name": "Spectrum On Demand",
          "logo_path": "/6qPtM96UZkt3Bu4ZFPsDeHFWUZ2.png",
          "display_priority": 122
        }
      ],
      "flatrate": [
        {
          "provider_id": 386,
          "provider_name": "Peacock Premium",
          "logo_path": "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png",
          "display_priority": 19
        },
        {
          "provider_id": 2528,
          "provider_name": "YouTube TV",
          "logo_path": "/48bVXEIyCLSL9pZUQ7gB9ToyWto.png",
          "display_priority": 41
        },
        {
          "provider_id": 387,
          "provider_name": "Peacock Premium Plus",
          "logo_path": "/yrEwyMzEKdqAoGhaWUARtIxByol.png",
          "display_priority": 214
        }
      ],
      "ads": [
        {
          "provider_id": 332,
          "provider_name": "Fandango at Home Free",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 42
        }
      ],
      "buy": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 24
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        }
      ],
      "link": "https://www.themoviedb.org/movie/872585-oppenheimer/watch?locale=US"
    },
    "GB": {
      "rent": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 35,
          "provider_name": "Rakuten TV",
          "logo_path": "/872dfVu1biZISJ8rO143CZZutPR.png",
          "display_priority": 7
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        },
        {
          "provider_id": 130,
          "provider_name": "Sky Store",
          "logo_path": "/nNkZ1JKe6vNhzti14KiKEUWHE6H.png",
          "display_priority": 20
        }
      ],
      "buy": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 35,
          "provider_name": "Rakuten TV",
          "logo_path": "/872dfVu1biZISJ8rO143CZZutPR.png",
          "display_priority": 7
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        },
        {
          "provider_id": 130,
          "provider_name": "Sky Store",
          "logo_path": "/nNkZ1JKe6vNhzti14KiKEUWHE6H.png",
          "display_priority": 20
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 25
        }
      ],
      "link": "https://www.themoviedb.org/movie/872585-oppenheimer/watch?locale=GB"
    }
  },
  "tv Game of Thrones": {
    "IN": {
      "flatrate": [
        {
          "provider_id": 2336,
          "provider_name": "JioHotstar",
          "logo_path": "/ledoS6EgdjTNq8F1e6wubUQer18.png",
          "display_priority": 4
        },
        {
          "provider_id": 614,
          "provider_name": "VI movies and tv",
          "logo_path": "/9SVVjJ89csOM0xoeVVK8BryUf9a.png",
          "display_priority": 35
        }
      ],
      "link": "https://www.themoviedb.org/tv/1399-game-of-thrones/watch?locale=IN"
    },
    "US": {
      "flatrate": [
        {
          "provider_id": 1825,
          "provider_name": "HBO Max Amazon Channel",
          "logo_path": "/64fLWeSyZ1KQZhIdvTdy4QHeWty.png",
          "display_priority": 13
        },
        {
          "provider_id": 1899,
          "provider_name": "HBO Max",
          "logo_path": "/skypuy7SXuugIQeYg0IglmzoKaS.png",
          "display_priority": 153
        }
      ],
      "buy": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        }
      ],
      "link": "https://www.themoviedb.org/tv/1399-game-of-thrones/watch?locale=US"
    },
    "GB": {
      "buy": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        },
        {
          "provider_id": 130,
          "provider_name": "Sky Store",
          "logo_path": "/nNkZ1JKe6vNhzti14KiKEUWHE6H.png",
          "display_priority": 20
        }
      ],
      "flatrate": [
        {
          "provider_id": 1825,
          "provider_name": "HBO Max Amazon Channel",
          "logo_path": "/64fLWeSyZ1KQZhIdvTdy4QHeWty.png",
          "display_priority": 15
        },
        {
          "provider_id": 1899,
          "provider_name": "HBO Max",
          "logo_path": "/skypuy7SXuugIQeYg0IglmzoKaS.png",
          "display_priority": 175
        }
      ],
      "link": "https://www.themoviedb.org/tv/1399-game-of-thrones/watch?locale=GB"
    }
  },
  "movie Parasite": {
    "IN": {
      "flatrate": [
        {
          "provider_id": 237,
          "provider_name": "Sony Liv",
          "logo_path": "/coM4QWbmIOa0xJ5cGR9BRmoV25B.png",
          "display_priority": 9
        },
        {
          "provider_id": 614,
          "provider_name": "VI movies and tv",
          "logo_path": "/9SVVjJ89csOM0xoeVVK8BryUf9a.png",
          "display_priority": 35
        },
        {
          "provider_id": 2792,
          "provider_name": "Sonyliv Amazon Channel",
          "logo_path": "/944iNBWJZwKT1lfO3y2oEqquQjG.png",
          "display_priority": 95
        }
      ],
      "link": "https://www.themoviedb.org/movie/496243/watch?locale=IN"
    },
    "US": {
      "free": [
        {
          "provider_id": 191,
          "provider_name": "Kanopy",
          "logo_path": "/cltb8XKan9ierp23ItPmCOcVLRa.png",
          "display_priority": 38
        }
      ],
      "rent": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 24
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        },
        {
          "provider_id": 331,
          "provider_name": "FlixFling",
          "logo_path": "/hkw2s2Su8EyifB9EbbQP64Fj1xA.png",
          "display_priority": 97
        }
      ],
      "buy": [
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 9
        },
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 10
        },
        {
          "provider_id": 3,
          "provider_name": "Google Play Movies",
          "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
          "display_priority": 23
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 24
        },
        {
          "provider_id": 7,
          "provider_name": "Fandango At Home",
          "logo_path": "/wpOt6x0dRxTrIzuBosto4LGd7E9.png",
          "display_priority": 40
        }
      ],
      "flatrate": [
        {
          "provider_id": 2303,
          "provider_name": "Paramount Plus Premium",
          "logo_path": "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png",
          "display_priority": 17
        },
        {
          "provider_id": 2616,
          "provider_name": "Paramount Plus Essential",
          "logo_path": "/uPWQPyF4nqwtfPNmGcFcenU57HG.png",
          "display_priority": 18
        }
      ],
      "link": "https://www.themoviedb.org/movie/496243/watch?locale=US"
    },
    "GB": {
      "rent": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 35,
          "provider_name": "Rakuten TV",
          "logo_path": "/872dfVu1biZISJ8rO143CZZutPR.png",
          "display_priority": 7
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        },
        {
          "provider_id": 189,
          "provider_name": "Curzon Home Cinema",
          "logo_path": "/4YC38wgKDkaL2NQiujnUFRt9VIB.png",
          "display_priority": 22
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 25
        }
      ],
      "ads": [
        {
          "provider_id": 41,
          "provider_name": "ITVX",
          "logo_path": "/nIViE3wOPV5Jyv45T7hetHyG6iS.png",
          "display_priority": 24
        }
      ],
      "flatrate": [
        {
          "provider_id": 11,
          "provider_name": "MUBI",
          "logo_path": "/k7iSlvgWzZuO4zU5PcBjhABMuia.png",
          "display_priority": 19
        },
        {
          "provider_id": 224,
          "provider_name": "BFI Player",
          "logo_path": "/waBWwU3aoY1IoypolMtDX4GOVDD.png",
          "display_priority": 23
        },
        {
          "provider_id": 287,
          "provider_name": "BFI Player Amazon Channel",
          "logo_path": "/lWzSEjT62Ob0XIHXdN7G4OQWCAr.png",
          "display_priority": 34
        },
        {
          "provider_id": 201,
          "provider_name": "MUBI Amazon Channel",
          "logo_path": "/w1hl8HszsPf5aAGT0mVY0O6LYP4.png",
          "display_priority": 39
        },
        {
          "provider_id": 1745,
          "provider_name": "Curzon Amazon Channel",
          "logo_path": "/pDthWS4h0ZjjpSaRUk4K9hl6oEN.png",
          "display_priority": 78
        },
        {
          "provider_id": 2041,
          "provider_name": "BFI Player Apple TV Channel",
          "logo_path": "/45RXTNyLafB9AKaZPNHryi2T9x1.png",
          "display_priority": 97
        },
        {
          "provider_id": 2300,
          "provider_name": "ITVX Premium",
          "logo_path": "/nIViE3wOPV5Jyv45T7hetHyG6iS.png",
          "display_priority": 113
        }
      ],
      "buy": [
        {
          "provider_id": 2,
          "provider_name": "Apple TV Store",
          "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
          "display_priority": 6
        },
        {
          "provider_id": 35,
          "provider_name": "Rakuten TV",
          "logo_path": "/872dfVu1biZISJ8rO143CZZutPR.png",
          "display_priority": 7
        },
        {
          "provider_id": 10,
          "provider_name": "Amazon Video",
          "logo_path": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
          "display_priority": 10
        },
        {
          "provider_id": 130,
          "provider_name": "Sky Store",
          "logo_path": "/nNkZ1JKe6vNhzti14KiKEUWHE6H.png",
          "display_priority": 20
        },
        {
          "provider_id": 192,
          "provider_name": "YouTube",
          "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
          "display_priority": 25
        }
      ],
      "link": "https://www.themoviedb.org/movie/496243/watch?locale=GB"
    }
  }
};
