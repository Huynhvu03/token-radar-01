# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Huynhvu03/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Huynhvu03/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every pre-token protocol DefiLlama tracks by what its launch would be worth — and tells you how to farm it. The watchlist (40 protocols with at least $50M of TVL and no token on record) is the floor; an early radar adds 160 pre-token protocols below that floor, by TVL. Each protocol's implied value comes from one model: its TVL times the median market-cap-to-TVL ratio of live-token protocols in its own category (calibrated from the snapshot itself), adjusted for 7-day growth, how long it has run with no token, and how many chains it runs on. No name is special-cased. The dashboard is a static page — board, detail view per protocol with the model's own inputs and a six-step farm plan, filter and sort — and it renders with no network.

## Run it

```sh
node main.ts --input /input --output /output
```

The sealed snapshot is mounted at `/input` by the grader. To reproduce locally, point `--input` at the kit's snapshot (`kit/token-radar-01-kit/input/snapshot.json`) and `--output` at a directory of your choice; the run writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` there. It is deterministic: the same snapshot in gives the same bytes out. Node 22 or later, standard library only, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tsfe6btp&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
