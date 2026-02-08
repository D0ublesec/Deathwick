# Bundled audio

Place your **copyright-free** sound files here. They are used by the game when served from this folder (e.g. via `npx serve .` or GitHub Pages).

## SFX filenames (optional)

If present, these replace the built-in synth tones. Use **MP3** or **OGG**; short clips (e.g. 0.1–0.5 s) work best for SFX.

### Actions (card play & turn)

| File         | When it plays              |
|-------------|----------------------------|
| `draw.mp3`  | Drawing a card             |
| `burn.mp3`  | Burning cards (into The Dark) |
| `haunt.mp3` | Haunt action (number card to neighbour’s Shadow) |
| `banish.mp3`| Banish — destroying a Ghost (no Siphon) |
| `cleanse.mp3` | Cleanse (7) / Siphon — destroying a Ghost with rank match |
| `salt.mp3`  | Using Salt (interrupt)     |
| `seance.mp3`| Séance — discarding a pair, taking bottom 4 from The Dark |
| `cast.mp3`  | Cast / Summon (face card or Joker effect) |
| `flicker.mp3` | Flicker — shuffle hand, draw 3 |
| `panic.mp3`  | Panic — flip top of Candle vs Ghost |
| `turn.mp3`  | Start of turn               |

### Outcomes & elimination

| File              | When it plays                          |
|-------------------|----------------------------------------|
| `win.mp3`         | Game won (last player standing)         |
| `eliminated.mp3`  | Player eliminated (e.g. Consumed, or killed by card) |
| `consumed.mp3`     | Consumed by the Darkness (empty Candle when must Burn) |
| `possession.mp3`   | Possession (3+ Ghosts of same suit in Shadow at end of turn) |

### UI (optional)

| File        | When it plays        |
|------------|----------------------|
| `click.mp3`| UI click             |

## Music (optional)

- `music.mp3` or `music.ogg` — background music (hook this up in settings when ready).

## Copyright

Only use audio you are allowed to **redistribute** in a commercial app (e.g. CC0, CC-BY, or a license that allows bundling). Keep a copy of the license or attribution in this folder if required.

**Examples of free SFX/music:**  
[Freesound.org](https://freesound.org), [OpenGameArt.org](https://opengameart.org), [Pixabay](https://pixabay.com/sound-effects/), [Mixkit](https://mixkit.co/free-sound-effects/).
