# THE MATRIX — SYSTEM BREACH

An immersive, browser-based simulation inspired by *The Matrix* (1999). You are not reading about the film: you are a person who has just found out that their reality is generated. A terminal wakes up unasked. You investigate your own record, confirm cracks in the world, choose a pill, train in a Construct, rewrite physics, hunt Agents in network traffic, run infiltration missions and finally attempt to leave.

> Unofficial fan project. Not affiliated with or endorsed by Warner Bros. All narrative text, art and code are original. No film footage, audio, dialogue or screenplay is used.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm test           # Vitest unit tests (state model + game logic)
```

Everything runs locally in the browser. Progress is stored in `localStorage` (key `matrix-system-breach`). Nothing is sent anywhere, and all "hacking" is fictional and sandboxed inside the page.

## The journey

| Step | Where | What actually happens |
|---|---|---|
| 1. Transmission | Boot sequence | Black screen → digital rain → typed system identification, connection diagnostics, an incoming transmission and **WAKE UP. THE SYSTEM IS NOT WHAT IT SEEMS.** Skippable (Esc). Returning users skip it automatically; it can be replayed from Settings or with the `boot` command. |
| 2. Identity | Identity | Deterministic fictional record (simulated ID, occupation, location, history, traits). *Verify identity* cross-checks it and exposes 3 inconsistencies. |
| 3. Anomalies | Simulation Diagnostics | An animated scan surfaces leads. Each anomaly is its own playable investigation: a pedestrian on a loop, a drifting clock, one object in two rooms, a corridor that regenerates, a carrier you must tune, and a sky seam visible only through a lens. Deeper scans need evidence. |
| 4. The choice | Pill decision | After 3 confirmed anomalies a transmission arrives. Hold to commit. **Red** awakens the interface (theme change, resistance link, +15% threat, new modules). **Blue** plays a mundane return sequence, locks the advanced modules as *suppressed*, and lets you question reality again later. |
| 5. Construct | Training Construct | Four real games: **Combat** (telegraphed highs/lows, block, perfect block, dash i-frames, counters, bullet time), **Bullet Time** (waves, volley warnings, charge + cooldown, measured reaction time), **Reflex** (visual/audio go/no-go with decoys, false starts, personal best and history), **Movement** (procedural platformer with gaps, spikes, drones, switch-gates, checkpoints, boost). |
| 6. Manipulation | Reality Manipulation | Three.js lab: gravity normal/reduced/zero/inverted; pause/slow/resume; spawn, select, drag, move, rotate, launch, freeze and remove objects; collisions; bounce and drag; training room, urban and minimal Construct environments; reset. |
| 7. Agents | Agent Detection | Animated network topology. Scan hosts (limited scans) and apply the tell rule (machine-perfect beacon timing, sub-physical latency, signature mismatch) to isolate Agents. Easy marks tells; medium/hard show only raw readings; on hard, Agents hand off to adjacent hosts and the log tells you where from. Wrong calls raise threat; wins unlock intel. |
| 8. Missions | Infiltration Missions | M01 Trace the Signal (probe triangulation) · M02 Identify the Anomaly (spot the patch) · M03 Evade the Agent (stealth with sight cones and bullet time) · M04 Breach the Network (rotating lattice puzzle) · M05 Reach the Exit (intel-driven route choice, then evasion). Each has a briefing, target, objectives, difficulty, tools, completion condition and reward. Rewards unlock modules, difficulties, intel and abilities. |
| 9. Escape | Exit Protocol | Five stages that reuse what you learned: anomaly identification → reflex check → rewrite the room (freeze the sentinel, invert gravity to float the key through the gate) → Agent evasion → decision. |

### Endings

- **Escaped**: answer the line with threat below 85%.
- **System Recaptured**: threat reaches 100% during the protocol, or you answer while Agents are close (≥ 85%).
- **Remaining in the Matrix**: walk away from the exit.
- **Undefined**: hidden. Confirm all six anomalies and recover the exit-routing hint, then trace the exit signal to its source.

Every ending shows a mission report: final threat, integrity, missions, anomalies, intel, abilities, exit score and a timeline.

### Threat level

Threat is one global number fed by everything you do: wrong guesses, false accusations, failed missions, sentinel deflections, the red pill. Successes lower it. At 100% outside the exit, an **Agent Lockdown** takes over the workspace until you go dark (threat resets to 60%).

## Controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Move | WASD / arrows (mouse in top-down games) | Virtual joystick |
| Jump | Space | JUMP |
| Boost / dash | Shift | BOOST / DASH |
| Interact | E | E USE |
| Bullet time | Q (hold in arena games) | BULLET T |
| Attack / block (combat) | J or click / K or right-click | ATTACK / BLOCK |
| 3D lab | click select · drag to move/orbit · wheel zoom · WASD/R/F move · Q/E rotate · Space launch · Delete remove | tap, drag, pinch |

Touch controls appear automatically on coarse-pointer devices and can be toggled on desktop. A command line (`help`, `status`, `whoami`, `open <module>`, `scan`, `transmission`, `sound on|off`, `boot`, `clear`, `reset`) drives the same state as the UI.

## Architecture

- **Stack:** React 19 + TypeScript, Vite, Tailwind CSS v4, Zustand (with `persist`), Three.js, Lucide icons, Web Audio API (synthesized, no audio files), self-hosted fonts (IBM Plex Mono, Rajdhani, Inter). Vitest for unit tests and Playwright for browser journeys. Framer Motion, R3F and a physics library were not needed: CSS handles transitions and the sandbox uses a small purpose-built physics step.
- **State:** `src/store/gameStore.ts` holds the entities: profile, simulation state, anomalies, missions + mission results, player abilities, training records, user decisions, intel, alerts and endings. `src/lib/derived.ts` turns that into every dashboard number (integrity, agent threat, escape progress, unlock rules), so no statistic is hard-coded.
- **Components** (`src/components`): `DigitalRainBackground`, `BootSequence`, `TerminalWindow`, `CommandInput`, `SystemStatusIndicator`, `SystemAlert`, `IdentityCard`, `PillSelectionInterface`, `SimulationCanvas`, `TrainingControls`, `BulletTimeIndicator`, `NetworkTopology`, `AgentThreatPanel`, `MissionCard`, `MissionBriefing`, `ProgressTracker`, `ExitProtocolScreen`, plus the shell (`NavRail`, `MonitorPanel`, `MobileNav`, `CommandConsole`, `LockedModule`, `LockdownScreen`) and the six anomaly investigations.
- **Games** (`src/games`): canvas games share `useGameLoop` (rAF, paused when the tab is hidden, clamped dt) and a unified input layer (`src/lib/input.ts`) that keyboard and touch both write into. `src/lib/realitySim.ts` is the reusable 3D sandbox used by the lab and the exit gate.
- **Modules** (`src/modules`): one per navigation item. The 3D modules are lazy-loaded, so Three.js is fetched only when needed.
- **Responsive:** desktop has persistent navigation, workspace and monitor; tablet collapses navigation to icons and moves the monitor into a drawer; phones get bottom navigation, drawers and touch controls with no horizontal overflow.
- **Accessibility and performance:** honours `prefers-reduced-motion` (with an in-app override), keyboard navigation throughout, status is shown with shapes and words as well as colour, the rain renders per-cell at capped DPR and pauses in background tabs, and sound is off until the first interaction and can be muted.

## Tests

```bash
npm test                          # unit: derived stats, store branching, network rules, lattice solvability, level generation
npm run dev &                     # then, with the pre-installed Playwright:
node e2e/01-intro.cjs             # boot, skip, persistence, commands, identity, all anomalies, blue → red
node e2e/02-training.cjs          # combat, bullet time, reflex and movement played by bots reacting to on-screen cues
node e2e/03-reality-agents.cjs    # every lab control, environments, frame rate, Agent detection
node e2e/04-missions-exit.cjs     # all five missions, the hidden anomaly, the exit protocol and all four endings
node e2e/05-responsive.cjs        # phone, tablet, keyboard-only, settings
```

The scripts run in order and share saved browser state. Screenshots land in `e2e/shots/` (git-ignored). Development builds expose a few read-only handles on `window.__sb` so the bots can see what a player sees on canvas; production builds do not include them.
