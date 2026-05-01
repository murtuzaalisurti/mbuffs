# Recommendation And Auth Debugging Notes

## Summary

Local recommendation slowness was caused by recommendation cache stampede behavior, not by Better Auth taking minutes.

The same database is used by local and dev, so persisted rows in `recommendation_cache` are shared. However, local and dev can still behave differently when one environment hits the cache while it is cold, expired, or actively regenerating.

## Auth Findings

Better Auth `getSession` was slow only before the `session_data` cookie existed.

Observed local logs:

```txt
[auth] getSession timing durationMs=1111-1609 hasSessionTokenCookie=true hasSessionDataCookie=false
[auth] getSession timing durationMs=1-8 hasSessionTokenCookie=true hasSessionDataCookie=true
```

Interpretation:

- `session_token` present and `session_data` missing means Better Auth must resolve the session through the backing store.
- Once Better Auth writes `session_data`, session reads are served from the cookie cache and are fast.
- This explains local `getSession` calls around 1-2 seconds, but not multi-minute recommendation requests.

## Recommendation Findings

The multi-minute local slowdown came from multiple requests generating the same expensive `for_you_pool` cache entry.

Observed local logs:

```txt
[recommendation] generated active cache endpoint='for_you_pool' durationMs=39156.5
[recommendation] generated cache without claim endpoint='for_you_pool' durationMs=202378.2
[recommendation] generated cache without claim endpoint='for_you_pool' durationMs=203152.1
[recommendation] served for you page durationMs=203997.6
```

Interpretation:

- One request correctly claimed the active cache-generation lock.
- Other requests waited only 6 seconds.
- After the wait expired, they generated the same `for_you_pool` without owning the lock.
- That caused duplicate TMDB/Reddit/DB work and made local requests take minutes.

## Why Local Was Slower Than Dev With The Same DB

The database cache is shared, but runtime state and request timing are not.

Reasons local can be slow while dev is fast:

- Dev may hit an already-fresh `recommendation_cache` row.
- Local may be the first environment to hit a cold or expired cache row.
- Local browser cookies are different from dev cookies, so Better Auth cookie-cache state is not shared.
- Local React dev behavior can trigger more startup prefetches and remounts than the deployed dev environment.
- Local network paths to Neon, TMDB, and Reddit can be slower than deployed runtime network paths.
- Before the fix, local waiters could start duplicate expensive generations after the 6 second lock wait.

## Cache Design Notes

The recent cache overhaul intentionally caches the expensive shared pool, not the final For You page.

Important behavior:

- `for_you_pool` is the expensive shared cache entry.
- `/api/recommendations` should derive the final paginated response from `for_you_pool`.
- Final For You responses should not be cached for the full recommendation TTL because they apply presentation shuffling.
- Category and theatrical endpoints use `getCachedRecommendationResult()` directly for their cacheable outputs.

## Fix Applied

The cache-lock behavior was changed so contenders do not regenerate without owning the lock.

Current intended behavior:

- One request claims generation for `for_you_pool`.
- Other requests wait longer for that generation to finish.
- If generation is still active after the wait, contenders fail instead of starting duplicate generation.
- Once the active row is written, local and dev should both serve from the same DB cache row.

## Useful Logs

Auth timing logs:

```txt
[auth] getSession timing {
  durationMs,
  authenticated,
  hasSessionTokenCookie,
  hasSessionDataCookie,
  cookieHeaderBytes
}
```

Recommendation timing logs:

```txt
[recommendation] cache hit
[recommendation] stale cache hit
[recommendation] generated active cache
[recommendation] cache hit after lock wait
[recommendation] generation still pending after wait
[recommendation] served for you page
```

Healthy warm-cache local behavior should show `for_you_pool` cache hits, followed by a fast `served for you page` log.

## DB Check

To verify whether the shared DB cache is warm for a user:

```sql
SELECT cache_key,
       slot,
       cache_version,
       expires_at,
       generation_started_at,
       updated_at,
       length(payload_json) AS payload_size
FROM recommendation_cache
WHERE user_id = '<user_id>'
ORDER BY updated_at DESC
LIMIT 20;
```

Healthy `for_you_pool` state:

- `slot = 'active'`
- `cache_version` matches the app constant
- `expires_at > NOW()`
- `generation_started_at IS NULL`
- `payload_size` is large enough to contain the generated pool
