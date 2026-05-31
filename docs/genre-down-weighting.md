# Genre Down-Weighting from Skip Signals

## Problem

Currently, skipping an item only excludes that specific item from future recommendations. It doesn't inform the recommendation engine about the user's genre preferences. A user who repeatedly skips horror movies will continue to see horror recommendations at the same rate.

## Proposal

Track skip frequency per genre and apply a soft scoring penalty when a pattern emerges.

## How it works

1. When a user skips an item, record its genre(s) alongside the skip event.
2. Maintain a per-user skip rate per genre: `skips_in_genre / total_recommendations_shown_in_genre`.
3. When the skip rate for a genre crosses a threshold (e.g., 3+ skips and skip rate > 0.6), apply a penalty multiplier to that genre's score during ranking.
4. The penalty should be soft (e.g., 0.7x-0.9x multiplier), not a hard filter — the genre still appears, just less often.

## Thresholds

- **Minimum skips before activation:** 3 skips in the same genre
- **Skip rate threshold:** > 60% of shown items in that genre were skipped
- **Penalty range:** 0.7x to 0.9x multiplier on the genre affinity score, scaled by skip rate
- **Decay:** Skip signals older than 90 days should be discounted to allow taste changes

## Where to apply

Apply the penalty in `applyMultiObjectiveRanking` when computing `genreAffinityNorm`. Multiply the raw genre affinity by the down-weight factor before normalization.

## Future extension

The same pattern can be applied to creative signals (director/writer/actor) once genre down-weighting is validated.
