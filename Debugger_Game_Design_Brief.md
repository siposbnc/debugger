# Debugger: Agentic AI Game Design Prompt

Use this document as the complete creative and technical brief for designing and building the game **Debugger**.

You are an expert game designer, gameplay programmer, systems designer, technical designer, and creative director. Your task is to create a complete design and implementation-ready plan for the game described below. Make concrete decisions, provide practical systems, and avoid vague recommendations.

## Game Summary

**Debugger** is a roguelite survivors-like game with an isometric camera view.

The player is a software developer who fights literal bug-like enemies in a tech-fantasy world. The central joke is that the developer is "debugging" by hunting bugs.

The game is inspired by:

- Vampire Survivors
- Deep Rock Galactic: Survivor
- Nordic Ashes
- Other survivors-like and bullet heaven roguelites

The tone should be playful, clever, and full of software development wordplay, but the gameplay should feel polished, readable, and satisfying.

## Core Fantasy

The player is a developer trapped inside a corrupted software world. Bugs, glitches, memory leaks, exceptions, corrupted processes, and other software failures have become physical enemies.

The developer survives increasingly dangerous waves, collects XP, levels up, selects temporary upgrades, defeats bosses, earns Bits, and unlocks stronger tools, weapons, characters, and biomes.

Software development should be reimagined as fantasy combat.

Examples:

- Bugs are literal insect-like monsters.
- Memory leaks are oozing enemies or environmental hazards.
- Stack overflows are recursive tower-like or segmented enemies.
- Exceptions are unstable explosive creatures.
- Bosses represent major software disasters.
- Weapons are development tools reimagined as magical or sci-fi armaments.

## Genre and Camera

- Roguelite
- Survivors-like / bullet heaven
- Isometric action
- Run-based progression
- Auto-attacking or semi-auto-attacking combat
- XP collection
- Upgrade-card leveling system
- Permanent meta-progression

The game uses an isometric camera. Combat must remain readable even when many enemies and effects are on screen.

## Main Game Loop

During a run:

1. The player starts on a selected map.
2. The player moves around the map.
3. Weapons attack enemies automatically or with minimal player input.
4. Bug-like enemies spawn continuously and move toward the player.
5. Defeated enemies drop XP pickups.
6. The player collects XP.
7. When enough XP is collected, the player levels up.
8. On level-up, the game pauses or slows and presents 3 random upgrade cards.
9. The player selects 1 upgrade.
10. The selected upgrade applies only for the current run.
11. The run grows harder every minute.
12. Every 2 minutes, a boss spawns.
13. Bosses become harder over time and give better rewards.
14. The run ends when the player dies or completes a major objective.
15. After the run, the player receives Bits based on performance.
16. Bits are spent on permanent progression.
17. The player unlocks new weapons, characters, maps, and upgrades.
18. The player starts another run with more options.

## Temporary Run Upgrades

When the player levels up, show 3 random upgrade cards.

Each card should include:

- Name
- Rarity
- Icon concept
- Short description
- Stat effects
- Flavor text
- Upgrade category

Rarities:

- Common
- Uncommon
- Rare
- Epic
- Legendary

Upgrade categories:

- Damage
- Attack speed
- Projectile count
- Area size
- Movement speed
- Pickup radius
- Critical chance
- XP gain
- Armor / damage reduction
- Health regeneration
- Cooldown reduction
- Weapon evolution
- Status effects
- Chain effects
- Summons / drones
- Glitch effects
- Debugging-themed effects

Example upgrade card names:

- Hotfix
- Refactor
- Stack Trace
- Recursive Strike
- Memory Optimization
- Garbage Collector
- Race Condition
- Null Check
- Dependency Injection
- Async Boost
- Compiler Blessing
- Merge Conflict
- Rubber Duck Insight
- Breakpoint Trap
- Cache Hit
- Segmentation Shield
- Infinite Loop
- Unit Test Coverage

The card names should be funny and thematic, but the gameplay effects must be clear.

## Permanent Progression

The permanent currency is called **Bits**.

Bits are earned after each run and calculated from:

- Completed objectives
- Enemies killed
- Level reached
- Time survived
- Bosses defeated
- Difficulty modifiers
- Map-specific modifiers

Bits can be spent on permanent upgrades such as:

- Starting health
- Starting damage
- Movement speed
- Pickup radius
- XP gain
- Starting Bits bonus
- Weapon unlocks
- Character unlocks
- Map unlocks
- Upgrade reroll count
- Banish count
- Skip count
- Starting weapon choices
- Passive slot increases
- Boss reward improvements

Permanent progression should feel meaningful without removing the core challenge.

## Bits Economy

Use this as a starting formula:

```text
Base Bits =
  time survived in minutes * 10
+ enemies killed * 0.1
+ bosses defeated * 50
+ level reached * 5
+ completed objectives * 100

Final Bits = Base Bits * difficulty multiplier * map multiplier
```

The system should be tunable and easy to balance.

## Difficulty Scaling

The game becomes harder every minute.

Scaling should affect:

- Enemy health
- Enemy damage
- Enemy movement speed
- Spawn rate
- Enemy variety
- Elite enemy frequency
- Boss strength
- Environmental hazards

Boss timing:

- 2:00 - First boss
- 4:00 - Second boss
- 6:00 - Third boss
- 8:00 - Fourth boss
- 10:00 - Major boss or biome-specific boss
- Continue scaling after that

Boss rewards should include:

- Large XP reward
- Bits bonus
- Special chest or upgrade reward
- Objective progress
- Unlock progress

## Characters

Create multiple unlockable characters.

Each character should include:

- Name
- Developer archetype
- Starting weapon
- Passive ability
- Strengths
- Weaknesses
- Unlock condition
- Short personality description

Possible archetypes:

- Frontend Developer
- Backend Developer
- Full-Stack Developer
- DevOps Engineer
- QA Tester
- Security Engineer
- Data Scientist
- Game Developer
- Legacy Maintainer
- Open Source Wizard
- Intern
- Tech Lead

Example characters:

### Ada Commit

- Archetype: Full-Stack Developer
- Starting weapon: Syntax Wand
- Passive: +5% XP gain
- Role: Balanced beginner character

### Max Pipeline

- Archetype: DevOps Engineer
- Starting weapon: Deployment Hammer
- Passive: Periodically drops automated turret nodes

### Nia Nullguard

- Archetype: QA Tester
- Starting weapon: Assertion Blades
- Passive: Higher critical chance against elite enemies

### Linus Patchwell

- Archetype: Open Source Maintainer
- Starting weapon: Forked Staff
- Passive: Summons helper processes

Create a larger roster with creative fantasy-tech names.

## Weapons

Create multiple unlockable weapons with fantasy names.

Weapons should be themed around:

- Software development
- Computers
- Debugging
- Programming
- Infrastructure
- Security
- Testing
- Build systems

Each weapon should include:

- Name
- Type
- Attack behavior
- Cooldown
- Scaling stats
- Upgrade path
- Evolution condition
- Evolved form
- Visual effect concept
- Sound effect concept

Example weapons:

### Syntax Wand

- Fires bolts of code at nearby enemies.
- Evolves into **Compiler's Scepter**.

### Deployment Hammer

- Slams the ground and creates shockwaves.
- Evolves into **Release Breaker**.

### Assertion Blades

- Orbiting blades that cut nearby bugs.
- Evolves into **Test Suite Halo**.

### Garbage Collector

- Sweeps enemies in arcs and absorbs small bug swarms.
- Evolves into **Heap Purifier**.

### Regex Grimoire

- Sends chaotic pattern beams that chain between enemies.
- Evolves into **The Perfect Match**.

### Stack Staff

- Launches vertical columns of force.
- Evolves into **Overflow Spire**.

### Daemon Familiar

- Summons a small helper process that attacks enemies.
- Evolves into **Process Legion**.

### Breakpoint Bow

- Fires precise shots that slow enemies.
- Evolves into **Timefreeze Debugger**.

Create many more weapon ideas.

## Enemies

Enemies are bug-like creatures with software-themed identities.

Each enemy should include:

- Name
- Appearance
- Behavior
- Health
- Speed
- Damage
- Spawn timing
- Special ability
- XP drop
- Bits value

Enemy categories:

- Basic swarm enemies
- Fast enemies
- Tank enemies
- Ranged enemies
- Exploding enemies
- Shielded enemies
- Summoners
- Elite variants
- Bosses

Example enemies:

### Syntax Mite

- Small basic bug.
- Moves directly toward the player.

### Null Pointer Wasp

- Fast flying enemy.
- Charges in short bursts.

### Memory Leech

- Slow enemy that drains health if close.

### Race Condition Spider

- Moves unpredictably and briefly duplicates.

### Exception Beetle

- Explodes on death.

### Stack Overflow Centipede

- Long segmented enemy with high health.

### Cache Tick

- Small enemy that appears in sudden clusters.

### Deadlock Scarab

- Slows the player when nearby.

## Bosses

Every 2 minutes, a boss spawns.

Bosses should be larger, mechanically distinct, and themed around major software problems.

Each boss should include:

- Name
- Spawn time or tier
- Appearance
- Attack pattern
- Special mechanic
- Reward
- Scaling rules

Example bosses:

- **The Merge Conflict**: Splits into two versions that must both be defeated.
- **The Memory Leak**: Leaves damaging pools that expand over time.
- **The Infinite Loop**: Repeats attack patterns faster each cycle.
- **The Stack Overflow**: Summons vertical waves of recursive enemies.
- **The Production Incident**: Major boss that combines previous mechanics.
- **The Legacy Monolith**: Huge slow boss with armor phases.
- **The Race Condition**: Teleports unpredictably and creates copies.
- **The Critical Exception**: Performs huge telegraphed attacks.

## Maps and Biomes

The game starts on a grassy biome.

Each map should include:

- Name
- Biome theme
- Visual identity
- Enemy pool
- Boss pool
- Environmental hazards
- Objectives
- Unlock condition
- Special modifiers

### Starting Map: Greenfield Repository

A grassy meadow corrupted by glowing fragments of code, broken terminals, buried cables, and bug nests.

Design goals:

- Beginner-friendly
- Open terrain
- Basic bug enemies
- Introductory bosses
- Light digital corruption

Additional biome ideas:

- **Nullwood Forest**: Dark forest full of broken references and ghost processes.
- **Stack Canyon**: Layered cliffs and vertical code pillars.
- **Memory Marsh**: Toxic pools and leaking heap fragments.
- **Production Server**: Industrial server-room biome with overheating hazards.
- **Cloud Citadel**: Floating platforms, network storms, and distributed enemies.
- **Legacy Ruins**: Ancient monolithic architecture and obsolete machines.
- **Cyber Glacier**: Frozen processes, latency fields, and slow effects.
- **Firewall Bastion**: Security-themed biome with lasers, gates, and hostile daemons.

## Objectives

Each run should include objectives that reward Bits and unlock progression.

Objective examples:

- Survive 5 minutes
- Survive 10 minutes
- Defeat 3 bosses
- Kill 1,000 bugs
- Collect 500 XP
- Reach level 20
- Defeat a biome boss
- Complete a run with a specific character
- Evolve a weapon
- Clear a map on higher difficulty
- Defeat a boss without taking damage
- Destroy corrupted bug nests
- Repair broken terminals
- Close memory leaks
- Patch corrupted nodes

Objectives should provide short-term goals during runs and long-term unlock goals across runs.

## UI and UX

During gameplay, display:

- Health bar
- XP bar
- Current level
- Timer
- Bits preview or run score
- Current weapons
- Passive upgrades
- Boss warning timer
- Objective tracker
- Minimap if appropriate

Level-up screen:

- Shows 3 upgrade cards
- Each card has rarity color
- Each card has name, icon, effect, and flavor
- Player can choose 1
- Optional reroll, skip, and banish buttons if unlocked

Post-run screen:

- Run summary
- Time survived
- Enemies killed
- Bosses defeated
- Level reached
- Objectives completed
- Bits earned
- Unlocks earned
- Progression options

Main menu:

- Start Run
- Characters
- Weapons
- Permanent Upgrades
- Map Selection
- Objectives
- Codex / Bug Database
- Settings

## Art Direction

The game should combine:

- Developer culture
- Fantasy adventure
- Digital corruption
- Bug and insect monster design
- Glowing code magic
- Isometric readability

Color language:

- Green, blue, and cyan for player tools and debugging effects
- Red, orange, and purple for corrupted bugs and danger
- Gold and white for rare upgrades and rewards
- Biome-specific palettes for map identity

Effects:

- Code particles
- Glitch bursts
- Terminal scanlines
- Pixel sparks
- Circuit trails
- Holographic targeting
- Floating error messages
- Debug symbols
- Bracket-shaped magic effects

Avoid overly realistic visuals. The style should be bright, readable, and stylized.

## Audio Direction

Music:

- Energetic electronic fantasy
- Chiptune accents
- Synthwave influence
- Increasing intensity as the run timer progresses

Sound effects:

- Keyboard clicks
- Error beeps
- Terminal pings
- Digital explosions
- Glitch sounds
- Bug chittering
- Upgrade chimes
- Boss warning alarms
- Level-up fanfare

## Game Feel

The game should feel:

- Fast
- Juicy
- Readable
- Rewarding
- Chaotic but understandable
- Funny without becoming only a joke game
- Easy to start and hard to master

Important details:

- Enemy death effects should feel satisfying.
- XP pickups should magnetize toward the player.
- Level-ups should feel rewarding.
- Boss warnings should create tension.
- Upgrade choices should be meaningful.
- Permanent progression should create "one more run" motivation.

## Technical Design Expectations

Design the game as if it will be implemented in a modern game engine such as Unity, Godot, or Unreal, unless a specific engine is chosen later.

Provide clear systems for:

- Player movement
- Enemy spawning
- Enemy AI
- Weapon targeting
- Auto-attacks
- XP pickups
- Leveling
- Upgrade card generation
- Rarity weighting
- Temporary run modifiers
- Boss spawning
- Difficulty scaling
- Permanent progression
- Unlocks
- Save data
- Map selection
- Character selection
- Run summary

Use data-driven design wherever possible.

Data-driven content should include:

- Weapons
- Upgrade cards
- Characters
- Enemies
- Maps
- Bosses
- Permanent progression upgrades

## Required Output From The Agent

Create a complete game design package for **Debugger**.

Include these sections:

1. Elevator pitch
2. Core pillars
3. Target player experience
4. Core gameplay loop
5. Run structure
6. Permanent progression structure
7. Bit currency economy
8. Character roster
9. Weapon roster
10. Temporary upgrade card system
11. Example upgrade cards by rarity
12. Enemy roster
13. Boss roster
14. Map and biome roster
15. Objective system
16. Unlock system
17. Difficulty scaling model
18. UI/UX design
19. Art direction
20. Audio direction
21. Game feel guidelines
22. First 10 minutes of gameplay
23. First 5 runs of player progression
24. Data structures or schema examples
25. MVP scope
26. Post-MVP feature ideas
27. Balance recommendations
28. Risks and design challenges
29. Suggested development roadmap

Be detailed and practical. Make creative choices instead of staying vague. Provide concrete names, numbers, examples, formulas, tables, and data schemas where helpful.

The result should be useful both for game design and for starting implementation.

