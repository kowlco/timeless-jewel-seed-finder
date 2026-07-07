# Transform spot-checks (guard against inheriting a reference bug)

The golden fixtures come from the reference implementation (`calculator.Calculate`).
To avoid inheriting a reference bug, these specific input→output rows should be
**independently cross-checked** against the live Vilsol web tool (vilsol.github.io/timeless-jewels)
or in-game. Patch 3.28.0 / tree 3.28.0.

| Jewel | Conqueror | Seed | PassiveID (_key) | Expected (from reference) |
|---|---|---|---|---|
| Glorious Vanity (1) | Ahuana | 100 | 708 | replaced → AlternatePassiveSkill index **2**, statRolls `[1]`, no additions |
| Lethal Pride (2) | Akoya | 10000 | 0 | augment-only → addition index **54**, statRolls `[15]` |

Status: **reference-derived, pending independent confirmation.** When confirmed against
the live tool/game, mark verified here. A mismatch means our oracle is wrong, not our port.

The bulk parity guarantee (2760 cases, `fixtures/transform.json`) is enforced by
`src/core/transform.test.ts` (Task 6).
