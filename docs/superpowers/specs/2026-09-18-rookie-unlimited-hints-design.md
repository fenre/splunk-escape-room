# Rookie Unlimited Hints Design

## Goal

Make Rookie mode suitable for players with very little Splunk experience by
allowing every task's available hints to be revealed without exhausting a
scenario-wide token pool.

## Behaviour

- `rookie.hintTokens` uses `-1` as the explicit unlimited sentinel.
- Rookie retains four hint levels per task, its 120-minute timer, ten-error
  limit, no trap codes, always-on SPL help, and 0.5 score multiplier.
- Every revealed hint still applies the existing level-specific point penalty
  and confirmation flow.
- `hintTokensSpent` continues to increase so achievements, ending
  classification, and telemetry retain meaningful usage counts.
- The mode selector and HUD display `∞` / “unlimited hint tokens”.
- Finite-token modes retain their current behaviour. A zero-token mode still
  means hints are unavailable.

## Delivery

The change belongs to the static `game.html` served by GitHub Pages. It does
not change the Splunk app package, add HEC, or add credentials. Automated tests
cover the preset, repeated spending, point deductions, and unchanged finite
mode exhaustion.
