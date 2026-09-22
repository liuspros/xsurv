# Shooter

A browser FPS built with Next.js 14, Three.js, and Tailwind. Runs entirely as
a website — no install, no app store.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, click "Click to start" to lock your mouse, then
WASD to move, mouse to aim, click to shoot, R to reload.

## Deploy

Same as your other projects: push this to a GitHub repo and import it into
Vercel, or run `vercel` from this folder.

## What's currently in `/public`

Real assets are already wired in and load automatically — if any of these
files are ever removed, the game falls back to its built-in procedural
placeholder for that piece, so it never breaks.

- **`models/gun.glb`** — a real detailed rifle model. Scale, rotation, and
  the muzzle-flash position were tuned in `components/Game.jsx` (search for
  `models/gun.glb`) based on this specific model's geometry.
- **`models/enemy.glb`** — a real rigged, skinned zombie character (a
  Mixamo export) with one animation clip. **Known limitation:** the only
  animation included is an attack ("Illegal Elbow Punch"), not a walk
  cycle, so enemies currently play that attack pose on loop while sliding
  toward you rather than visibly walking. To fix: export a "Walking" or
  "Zombie Walk" animation for the same character from Mixamo, save it as
  `models/enemy.glb` (replacing this one), and it'll pick it up
  automatically — no code changes needed, since the game always plays
  whichever animation clip is first in the file.
- **`models/creature-bonus.glb`** — a nicely made stylized sci-fi/fantasy
  humanoid, included but **not currently wired into the game**. It has no
  skeleton or animation, and its look (glowing teal armor, fantasy style)
  doesn't match a realistic human enemy. Kept here in case you want to use
  it later as a special/boss enemy type.
- **`sounds/gunshot.mp3`** — a real gunshot recording, trimmed to a punchy
  ~0.4s clip so it doesn't overlap into a mess when firing rapidly. The
  original full recording (crack + several seconds of echo) is kept at
  `sounds/gunshot-full-echo.mp3` in case you want it for a slower weapon
  later (e.g. a bolt-action rifle where shots are seconds apart).
- **`sounds/reload.mp3`** — a real reload sound.
- Still procedural/synthesized: `hit`, `kill`, `damage`, and `empty` sounds.
  Add real files at `sounds/hit.mp3`, `sounds/kill.mp3`,
  `sounds/damage.mp3`, `sounds/empty.mp3` to replace them the same way.

## Adding or replacing assets

Drop a differently-named or re-exported file into the paths above and it's
picked up automatically — the only case that needs a code touch is if a
*new* model's scale, orientation, or muzzle point differs enough from what's
there now that it looks wrong (too big/small, sideways, upside down). That's
normal — every export tool scales and orients models differently. The fix
is always in `components/Game.jsx`:

- For the gun: search for `models/gun.glb`, adjust `gunMesh.scale` and
  `gunMesh.rotation.x` (try `Math.PI / 2` instead of `-Math.PI / 2` if it
  comes in backwards).
- For the enemy: search for `models/enemy.glb`, adjust the `0.01` scale
  factor.

Where to find more free assets:
- **Kenney** (https://kenney.nl/assets) — CC0 weapon/prop packs.
- **Sketchfab** (https://sketchfab.com) — filter "Downloadable", many
  ready as glTF/glb, including rigged/animated characters.
- **Mixamo** (https://www.mixamo.com, free with an Adobe account) — human
  characters and a huge animation library; export FBX, then convert to glb
  via Blender's import/export (free) if you need it in that format.
- **Freesound** (https://freesound.org) / **Pixabay Sound Effects**
  (https://pixabay.com/sound-effects/) — real recorded SFX, filter by
  license (CC0 needs no attribution).

## What's still worth building next

- A proper walk animation for the enemy (see limitation above) is the
  single biggest realism upgrade available right now, and needs no code
  change once the file is replaced.
- The arena is a handful of boxes — a real level (better geometry, more
  interesting cover, maybe distant terrain) is a good next step.
- Only one gun and one enemy type exist right now. The code is structured
  so a second of either is mostly copy-and-adjust work in `Game.jsx`.
- No multiplayer, no persistence. Firebase (Auth + Firestore) is the
  natural next addition for accounts, high scores, or a daily-challenge
  leaderboard, matching the stack you already use elsewhere.

