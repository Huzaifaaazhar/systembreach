# SYSTEMBREACH

An interactive, browser-based simulation-breach experience in seven chapters. It uses black and phosphor green, monospace terminals, digital rain, glitch transitions and dark wireframe 3D, with restrained synthesized sound.

The world is a simulation, so its rules become mechanics. You read the rain, crack the firewall, slow time to dodge trace packets, outthink the sentinels and finally rewrite physics to escape. Wrong decisions raise the system's **threat level**, which carries across every chapter. At 100% the trace completes.

## Run it

It is a static site with no build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need `http://` (opening `index.html` as a `file://` URL will not work). Three.js and both fonts are stored in the repo (`vendor/`, `assets/fonts/`), so it runs offline.

Useful URL flags:

- `?ch=N` jumps to chapter N if it is unlocked
- `?dev` unlocks every chapter, for testing

## Chapters

| # | Chapter | Mechanic | What it teaches |
|---|---------|----------|-----------------|
| 01 | Boot Sequence | Real terminal (`HELP`, `SCAN`, `LOGIN`, …) with clickable hints | The interface, and that noise gets noticed |
| 02 | The Signal | Click the steady white glyphs in a rain field and avoid the flickering red ones | Perception. The key word you pull out is needed again at the exit |
| 03 | Decryption | Four-glyph hex code-breaking with hit/near feedback; first 4 attempts free | Reading system feedback; brute force is loud |
| 04 | Bullet Time | Dodge aimed trace packets; hold **Space/Shift** or the ◎ button to slow the world while you keep full speed; limited focus | Time is a variable |
| 05 | Pursuit | Sentinel dashboard (3D wireframe city, heat zones, alert %, live log) with three timed decisions | The intel in the log reveals the right call; wrong calls and hesitation raise threat |
| 06 | Reality Manipulation | 3D sandbox: gravity vector and strength, time dilation, freeze all, click to freeze single objects, impulses | The simulation's rules can be broken |
| 07 | Final Escape | Recall the key, choose a route (Downtown Loop or Service Tunnel 7), survive a bullet-time run, then freeze the guard and invert gravity to carry the key into the gate | Everything combined |

### Endings

The ending depends on final threat and average performance across chapters:

- **The Rules Are Yours** (root access): threat ≤ 25% and performance ≥ 80%
- **Liberated**: threat < 60%
- **Ghost Signal**: escaped, but traced
- **Recaptured**: threat reached 100% during the escape

## Controls

- Mouse, touch and keyboard all work. Terminal input supports ↑/↓ history.
- Bullet time: hold Space or Shift, or hold the ◎ button (touch-friendly).
- Movement in bullet time: mouse, drag, arrows or WASD.
- 3D scenes: drag to look, click or tap an object to freeze it.
- `≡ MAP` jumps between unlocked chapters or wipes progress. `SND` toggles sound.

Progress (threat, scores, choices, endings found) is saved in `localStorage`.

## Structure

```
index.html            shell: HUD, stage, chapter map, CRT overlays
css/style.css         visual identity, windows, CRT/glitch effects, responsive rules
js/main.js            router, threat system, transitions, chapter map
js/state.js           persisted run state
js/audio.js           WebAudio sound effects (no audio files)
js/rain.js            background digital rain (slows with time dilation, reddens with threat)
js/terminal.js        reusable phosphor terminal
js/engines/           dodge (bullet time), rainhunt, city (3D), reality (3D physics), tunnel
js/chapters/c1–c7     one module per chapter
vendor/               three.js r170 (MIT)
assets/fonts/         VT323 and Share Tech Mono (SIL OFL)
```
