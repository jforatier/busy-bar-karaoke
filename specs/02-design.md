# 02 — Design

The intentions behind every screen. Reference captures of every screen, taken on the real bar, are in [ui-mockups/](ui-mockups/) with the scripts that draw them; the capture, not a PC render, is the reference. Screen-by-screen behaviour is in [01](01-behaviour.md).

## Intentions

1. **Readable at arm's length, while singing.** The lyric line is the one focal point, in the largest font that fits; the comet above it carries the rhythm. Giant words for a room.
2. **A tiny karaoke machine, not a terminal.** Count-in, colour, a finale: the bar should feel like a toy that is happy to see you sing.
3. **Use the platform, don't fight it.** Native text scroll instead of per-frame redraws, firmware fonts, the stock "event" sound for applause.

## Grid (72×16 front)

| Role | Font / shape | Position | Notes |
|---|---|---|---|
| Song list | `small` artist (dimmed) + amber position, then the title in `bold` | y = −1, then y = 5 | The title is the focal point |
| Comet | 3×3 star, 1×2 rainbow streak | rows 0–5 | The rhythm, made visible |
| Lyric line | `bold` (caps rows 7–13 at y = 5) | x = 1, y = 5 | Sung part redrawn in the sung colour; slides when wider than 70 px |
| Giant word | `extra_large` | centred, y = 1 | One word, readable from across a room |
| Count-in | `bold` amber digit at x 1 with the comet bouncing on it, line dimmed after; the giant digit itself in words | lyric row | On the beat |
| Row 15 | — | — | Descenders only: nothing else touches it |

No `tiny` anywhere a person must read (its "3" looks like ">" on the LEDs).

## Grid (160×80 back, greyscale)

Usable width 146 px: the system icons cover x ≥ 148 and cut any text that reaches them.

| Role | Font / shape | Position | Grey |
|---|---|---|---|
| Header | `small` song title (or `KARAOKE` on the list) | y = −1 | dim `#5A5A5A` |
| Progress | 1 px rule, filled as the song plays | row 9 | `#2A2A2A`, fill `#8C8C8C` |
| Line just sung | `bold` | y = 13 | faint `#3C3C3C` |
| Current line | `bold`, up to two rows, 12 px apart; sung part on top | y = 26 | `#8C8C8C`, sung white |
| Lines to come | `bold` | below, down to y = 66 | dim `#5A5A5A` |
| Song list | `bold` titles, 13 px apart, `>` before the chosen one | y = 12 … 64 | chosen white, others dim |

On the back every colour turns grey (amber, pink and cyan all read as mid-grey), so the palette below becomes four brightness levels: white = sung, grey = to sing now, dim = coming, faint = gone. Light stands in for the front's rainbow: BRAVO's letters carry a wave of light. Nothing on the back moves between syllables, so the front keeps its frame rate.

## Palette

Colour carries one meaning each, everywhere:

| Colour | Meaning |
|---|---|
| White `#FFFFFF` | words still to sing |
| Amber `#FFB000` | words sung; the count-in |
| Rainbow | the rhythm's joy: the comet's streak, giant words, BRAVO |

## Motion

- **The rhythm drives everything that moves**: the comet lands on each syllable on its note, words pop on their syllable, the count-in ticks on the beat. Nothing blinks for its own sake: what disturbs the reading goes (no pulses at the edges).
- Text moves only when it must (a line too wide), following the action.
- No blank frame, ever: elements are replaced in place, never deleted between frames.
- The finale is the only free-form animation: letters drop in one by one, bounce on a sine wave, flash, settle (3.2 s).

## Icon

Microphone held diagonally (🎤), silver head, pink handle, 8×8 colour front + 11×11 grey back. On the bar the app is named **Karaoke** (manifest `name`), which fits on one line in the launcher.

## Sound

The speaker is small and weak in the bass ([04](04-platform.md)): synthesized tracks keep the melody high (octaves 4–5) on a bright 25 % square wave, over a light triangle-wave accompaniment, peak-normalized to 85 % ([03](03-songs.md#scores)).
