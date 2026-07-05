# The Great Rewrite — prestige design doc (v0.5)

*Status: **APPROVED 2026-07-02** (user review — rulings recorded verbatim under §9, extra
asks under §10; both are folded into the body, so §1–8 read as the implementation spec).*

This is the design for the prestige layer: what triggers it, what a **Rewrite** resets,
how **Legacy Tokens** are earned and spent, and how the pacing avoids the two named
risks — invalidating the honest 25–35-run shop curve, and becoming a pure number
treadmill. It builds on DESIGN.md pillar 5 (*meta progression is mandatory — there must
always be a wall worth returning stronger for*): prestige is that pillar extended past
the last wall.

---

## 1. Theme & fiction

You are the developer. After you beat the last map, the only bug left worth fixing is
the codebase itself — so you **ship the Great Rewrite**: v2.0 of yourself. Everything
you bought burns down; what you *learned* compiles into the new version.

- The act is a **Rewrite**; the button says **`SHIP IT`**.
- The main menu shows your major version next to the build tag: fresh save = `you: v1.0`,
  after two rewrites = `you: v3.0`.
- The currency is **Legacy Tokens** (⟲) — "the parts of the old codebase worth keeping."
- Flavor register per repo conventions: the pun lives in names/flavor; mechanics text
  stays literal.

## 2. Trigger & the SHIP IT flow

- **Availability**: the `SHIP IT` button appears once the **last map (Cyber Glacier) is
  first cleared in the current cycle** — "the base game is beaten." It never appears
  earlier; a fresh player sees no prestige surface at all (same reveal philosophy as
  curses/endless).
- The player may keep playing before shipping to earn more tokens, with **diminishing
  returns** built into the formula (§3) — grinding is allowed, never optimal.
- **Flow**: `SHIP IT` opens the Rewrite screen: live token breakdown (§3), a
  reset/persist table (§4), the kept-upgrade picker if Persistent Config is owned
  (§5-A), and a two-step arm/confirm (the KILL PROCESS pattern — `SHIP v2.0 — ARE YOU
  SURE?`). A **suspended run blocks shipping** (finish or discard it first).
- Post-ship: a release-notes-styled cycle summary ("v2.0.0 shipped — 34 runs, 41,200 ⌬
  earned, longest shift 19:42"), then the main menu at the new version.

## 3. Legacy Token formula

Three inputs, all cycle-scoped, all already trackable or one new counter away —
predictable enough for a **live "tokens on rewrite: N" counter** shown on the menu
button and the Rewrite screen:

```
tokens = 3 × mapsCleared            (unique maps first-cleared this cycle, ≤ 4 → ≤ 12)
       + floor(√(cycleBits / 150))  (cycleBits = Bits EARNED this cycle, spent or not)
       + floor(overtimeMin / 3)     (sum of per-map best overtime minutes this cycle)
```

- **Calibration** (from the live economy: full meta shop ≈ 10,880 ⌬, strong victory
  1,500–2,100 ⌬, first glacier clear plausibly ~35–50 runs / ~20–30k ⌬ earned): a
  no-grind first rewrite lands at **≈ 24–28 tokens** (12 maps + ~12 bits + ~2 endless).
- **Diminishing returns**: the √ term needs ~4× the Bits to double — exactly the
  roadmap's proposal. Maps saturate at 4; overtime saturates at the collapse ceiling
  (~+10–15 min across all maps even for god builds, since every endless run ends).
- New save counters: `cycleBits` (increments beside `lifetime.bitsEarned`), and
  `mapVictories`/`endlessBest` already carry the rest — but note `endlessBest` persists
  as a lifetime record (§4), so the token input is a cycle-scoped copy
  (`cycleOvertimeBest`), not the record itself.

## 4. What resets, what persists

| Resets on Rewrite | Persists forever |
|---|---|
| Meta shop levels (`metaLevels`) | Codex encounters & NEW-badge state |
| Bits wallet | Completed objectives (incl. future rarity-gate progress — the "first runs ever" gauntlet doesn't repeat) |
| Weapon licenses (`unlockedWeapons`) | Lifetime stats & records (`lifetime`, `endlessBest`) |
| Maps (back to Greenfield) & characters (back to Ada) | Meta-shop row reveals (`unlockedMeta` — re-scrambling known rows is noise, not discovery) |
| `mapVictories` (⇒ Endless re-locks per map until re-cleared) | Settings, keybinds, patch-notes-seen |
| Curse/Endless pre-run toggles (back to off) | **Everything prestige**: rewrite count, tokens, tree nodes |

Rationale: the early game must become *meaningful* again (that's what the Momentum
branch accelerates and what map tiers re-harden), but knowledge is never taken back —
the player re-earns power, not information. Objectives persisting also means their
one-time ⌬ bonuses don't re-pay, which the Ship Bonus (§6) more than covers.

## 5. The tree — sells mechanics, not just stats

Three branches, ~20 nodes, ~300 tokens to complete (≈ 6–9 rewrites). Nodes are typed:
**[M]** new mechanic, **[K]** keep/compression, **[E]** economy. Costs in ⟲.

**Unlock gating (user ruling 2026-07-05)**: the tree renders as a node *graph*; each
branch is a **binary tree** — a node opens once its parent has ≥ 1 rank (branch roots
are always open). Current edges: Warm Boot → {Severance Package, Preflight Check},
Severance Package → Persistent Config; Dash Module → {Restore Point, Sudo Mode};
Compound Interest → {Continuous Learning, Time Dilation}. The stage-4 endgame levers
slot in as deeper children when they land (proposal: Deployment Tiers under Time
Dilation, Over-Cap Shop under Continuous Learning, Overclocked Cooling / Critical
Path under the Skills leaves).

### A. Momentum — "hit the ground running" (the anti-tedium branch)
| Node | Ranks | Cost | Effect |
|---|---|---|---|
| Warm Boot **[K]** | 3 | 5/10/18 | Runs start at level 2/3/4 (with the matching card picks owed) |
| Severance Package **[K]** | 3 | 5/10/20 | Each new cycle starts with 500/1,500/3,000 ⌬ |
| Persistent Config **[K]** | 3 | 12/18/25 | Keep 1/2/3 *chosen* meta upgrades' levels through every future Rewrite (chosen at SHIP IT; maxed rank ⇒ three full upgrades survive) |
| Preflight Check **[K]** | 1 | 10 | Weapon evolutions become **available at weapon level 7** instead of 8 (the boss chest is still required) — the approved counter-proposal to pre-unlocked evolutions (§9-Q2) |

### B. Skills — the new active-input layer (the flagship [M] branch)
| Node | Ranks | Cost | Effect |
|---|---|---|---|
| Dash Module **[M]** | 1+2+2 | 10, then 6/6 and 8/8 | Unlock **Dash**: a keybound burst (~140 u over 0.18 s) with i-frames, 4 s cooldown, HUD pip. Rank-ups: +i-frame duration ×2, −1 s cooldown ×2. *Engineering note: needs a keybind (proposal: Space / pad B), a cooldown UI, and an i-frame flag in `run.ts hurtPlayer` — the priciest node to build, and the strongest proof the tree sells mechanics.* |
| Restore Point **[M]** | 3 | 15/20/30 | **Revive** on death at 50% HP with 2 s of invulnerability + a magnet burst; ranks = 1/2/3 revives per run. *(Interacts cleanly with Endless: a banked victory already survives death; revives just extend the shift.)* |
| Sudo Mode **[M]** | 1+2 | 15, then 10/10 | Third active (§9-Q6 ruling): a keybound burst of **root privileges — 3 s of invulnerability, +50% damage and +25% cooldown reduction**, ~75 s cooldown, HUD pip beside Dash. Rank-ups: +1 s duration, −15 s cooldown. Input proposal: Shift / pad Y (Dash owns Space / pad B) |

### C. Leverage — economy & the designed endgame
| Node | Ranks | Cost | Effect |
|---|---|---|---|
| Deployment Tiers **[M]** | 1 | 8 | Unlock the **map tier selector** (§7): re-run any map at Tier N ≤ your rewrite count — harder, richer |
| Over-Cap Shop **[E]** | 1 | 12 | Meta upgrades can be bought **past their caps**: cost growth ≈ `growth^2.2`, effect per level halved past cap. *This is the roadmap's "infinite meta levels" P2 and the designed solve for glacier's amended 30–40% maxed band — re-certify §5 when it lands.* |
| Overclocked Cooling **[M]** | 2 | 12/15 | Raises the **cooldown-reduction cap** 75% → 80% → 85% (§10 ask). *Balance-flagged: each rank re-runs the `blades-cdr` tripwire with the node active — that scenario is its acceptance test* |
| Critical Path **[M]** | 1 | 15 | Raises the **crit ceiling**: crit chance past 100% **converts to bonus crit damage** (each 1% overflow = +1.5% crit multiplier; §10 ask — `stats.ts` overflow conversion) |
| Compound Interest **[E]** | ∞ | 5 + 2/rank | +3% Bits per rank — the infinite tail, priced so late ranks are strictly worse than playing better (treadmill guard: linear benefit, linear-growing cost, vs √ token income) |
| Continuous Learning **[E]** | ∞ | 5 + 2/rank | +3% XP per rank (§10 ask: the XP ladder for reaching higher levels on higher-tier maps) — same repeatable pricing as Compound Interest |
| Time Dilation **[E]** | 2 | 6/10 | 1.25× / 1.5× game-speed toggle (QoL for veterans; sim-side it's just the existing `simSpeed`) |

**Deliberately absent**: pre-unlocked weapon evolutions (trivializes boss chests — the
counter-proposal is §9-Q2's "evolution ready one weapon-level earlier"), and
tree-gated characters/weapons (content stays Bits-bought inside a cycle; the tree sells
*mechanics and momentum*, not the content list — §9-Q3).

## 6. Ship Bonus (the permanent multiplier)

Each completed Rewrite grants a permanent, additive **+30% Bits and +10% XP** ("Ship
Bonus" — Bits ×1.3, ×1.6, ×1.9… / XP ×1.1, ×1.2, ×1.3…). The Bits half applies as a
final multiplier in `computeBits` alongside the map multiplier (after the
overtime/curse breakdown lines, so those stay legible); the XP half folds into
`computeStats` like an xpGain mod. *(The XP half is the §9-Q7 ruling: prestige pay must
lift levels too, not just the wallet — it's also what makes higher Deployment Tiers
reachable, together with Continuous Learning.)*

- **Curve protection**: the bonus does not exist in cycle 1 — the certified 25–35-run
  shop curve is untouched for every player who hasn't prestiged. With ×1.3 + Momentum
  nodes, cycle 2 should complete the shop in **~60–70%** of cycle 1's runs; cycle 4+ in
  roughly half. Compression comes from *starting further ahead and earning faster*, not
  from nerfing the wall.

## 7. Deployment Tiers (merges the "infinite map ladder" P3)

The roadmap's separate "procedural infinite map ladder" P3 and the design-doc's "map
tier per prestige" are **the same feature — merged here**, no procedural generation:

- Tier N (selectable per map on map select, like the Endless toggle; max = rewrites):
  enemies **+12% hp & damage per tier, compounding** (`enemyScale × 1.12^N`) and
  **+25% Bits per tier** (additive with the map's own `bitsMult`).
- Tier is orthogonal to Endless and Curses — all three stack; that stack is the veteran
  endgame and is *explicitly outside* the §5 certification bands (tier 0 is the
  certified baseline, exactly like curses/overtime today).
- Best-time / longest-shift records stay per map, not per tier (keep the leaderboard
  simple; revisit if tiers make records trivial).

## 8. Pacing targets & certification plan

| Target | Value |
|---|---|
| First Rewrite reachable | ~35–50 runs (first glacier clear + zero grind) |
| First Rewrite tokens | ~24–28 ⟲ (buys Dash + a Momentum node, or two Momentum nodes + a starter) |
| Cycle-2 shop completion | 60–70% of cycle-1 runs |
| Tree "complete" (all finite nodes) | **~10 rewrites** (§9-Q4 ruling; finite tree ≈ 330 ⟲ vs ~30–40 ⟲/cycle mid-game) |
| Infinite tail | Compound Interest + Continuous Learning + Over-Cap Shop + Tiers (all diminishing or self-pricing) — "infinite progression will have new surprises later" (§9-Q4) |

Verification when implemented: `prestigeTest.ts` (token formula, reset/persist table,
kept-upgrade selection, tier scaling, cap-raiser math); §5 re-cert **only** for
Over-Cap Shop (it moves the maxed-meta ceiling — the glacier 30–40% amended band is its
acceptance test); each Overclocked Cooling rank re-runs the `blades-cdr` tripwire with
the node active; sim tooling gains a prestige config on the scenario schema
(`startLevel`, `revives`, `dash`, `tier`) so the arms stay scriptable. Save schema:
`rewrites`, `legacyTokens`, `tree: Record<string, number>`, `cycleBits`,
`cycleOvertimeBest`, `keptMeta: string[]` — all additive (merge-over-defaults, no
migration step).

**Implementation order** (one commit-sized stage each, verify between):
1. **Core**: save fields + `data/prestige.ts` (node defs, token formula), SHIP IT
   button/screen, the reset itself, `you: vN.0` version display, `prestigeTest.ts`.
2. **Passive nodes**: tree spend UI + Warm Boot, Severance Package, Persistent Config,
   Preflight Check, Compound Interest, Continuous Learning, Ship Bonus (Bits+XP),
   Time Dilation.
3. **Actives**: Dash (keybind/i-frames/HUD pips), Restore Point, Sudo Mode.
4. **Endgame levers** (balance-flagged): Deployment Tiers, Over-Cap Shop, Overclocked
   Cooling, Critical Path — with the §5/blades-cdr re-runs above.

## 9. Open questions — decisions needed at review

1. **Reset scope**: table in §4 resets licenses/maps/characters (full re-earn each
   cycle). Softer alternative: only meta shop + Bits reset. The full reset is proposed —
   Momentum exists to absorb the tedium — but it's the doc's most reversible-by-ruling call.
    - **DECISION:** Full reset.
2. **Evolutions node**: confirm the counter-proposal (**Preflight Check [K]**, ~10 ⟲:
   evolutions become available at weapon level 7 instead of 8; boss chest still required)
   over the draft's "pre-unlocked evolutions".
    - **DECISION:** Approved. Evolutions become available sooner.
3. **Active skills**: proposed to live **in the tree** (§5-B) rather than a separate
   unlock track — the tree needs them to honor "sells mechanics". Confirm.
    - **DECISION:** Confirmed.
4. **Token constants** (3/map, `√(bits/150)`, `overtime/3`): accept as the starting
   calibration with a tuning pass at implementation, or re-anchor now?
    - **DECISION:** Completing the tree should be doable with around 10 cycles. Infinite progression will have new surprises later.
5. **Dash input**: Space (proposal) vs Shift; pad **B** vs a trigger. (Space currently
   unbound in runs; menus use it as select — no conflict in-run.)
    - **DECISION:** Space and pad B is fine.
6. **Third active skill** for the reserved §5-B slot — current candidates: **Hotfix**
   (manual heal charge), **Force Push** (radial knockback burst — but knockback is
   globally disabled by design, `KNOCKBACK_SCALE = 0`), **Sudo Mode** (2 s of god-mode,
   long cooldown). Or leave the slot empty until post-v0.5 feedback.
    - **DECISION:** Sudo mode with additional increased damage and cooldown reduction.
7. **Ship Bonus size**: +30%/rewrite additive — too fast/slow for the cycle-2 ~65%
   target? (Simulable before implementation via the matrix once Momentum nodes exist.)
    - **DECISION:** Acceptable, however current modifiers are all for increased bits. Exp needs to be boosted as well.

## 10. Review notes

1. Need some exp-related unlockable skills as well to reach higher levels on higher tier maps.
   *→ incorporated: Ship Bonus now carries +10% XP per rewrite (§6) and the repeatable **Continuous Learning** node joins Leverage (§5-C).*
2. Need tree nodes that increase some caps in the game. Cooldown reduction and crit chance for example. Crit chance after 100% becomes bonus crit damage.
   *→ incorporated: **Overclocked Cooling** (CDR cap 75→80→85%, blades-cdr-tripwire-gated) and **Critical Path** (crit overflow → +1.5% crit damage per 1%) in §5-C.*
