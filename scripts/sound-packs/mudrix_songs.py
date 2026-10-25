"""Song-style ring and ringback for the Mudrix Bloop and Glass candidates.

Needs the michael-rosen-says repo (app.ytpmv). From that repo root:
    PYTHONPATH=. python <this file> <out_dir>

Short tracker tunes in the manner of the NES pack's ring, but gentler: slower, lower, soft
drums, a bass that grooves, and a lead that sits in the mix instead of on top of it.
Bloop is NES (triangle bass and kick, hollow pulses, a noise kit) and Glass is Mega Drive (slap
bass, FM bubbles, a bell, a string pad, a light kit).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _common import SR, finish, write_wav  # noqa: E402
from mudrix import BELL, BLIP, Chan, Channel, Mix, SLAP, _md, mixdown, smix, stack  # noqa: E402

P = _md.P
KICK, SNARE, HAT, STRINGS = P["md-kick"], P["md-snare"], P["md-hat"], P["strings"]


def steps(line: str):
    """A tracker line: one token per 16th, '.' rests, '-' holds the note before it."""
    toks = line.split()
    for i, tok in enumerate(toks):
        if tok in (".", "-"):
            continue
        hold = 1
        while i + hold < len(toks) and toks[i + hold] == "-":
            hold += 1
        yield i, tok, hold


def up(n: str, k: int = 1) -> str:
    return n[:-1] + str(int(n[-1]) + k)


# ── Bloop: NES ───────────────────────────────────────────────────────────────────────────────
def bloop_ring() -> np.ndarray:
    """E - B - C#m - A at 104 bpm: triangle bounce, a soft arpeggio, a hollow lead with echo."""
    s16 = 60.0 / 104.0 / 4.0
    secs = 32 * s16
    lead = Channel("pulse", secs, duty=2)
    echo = Channel("pulse", secs, duty=2)
    arp = Channel("pulse", secs, duty=3)
    tri = Channel("triangle", secs)
    noi = Channel("noise", secs, setting=1)

    roots = ("E2", "B1", "C#2", "A1")
    chords = (("E4", "G#4", "B4"), ("B3", "D#4", "F#4"), ("C#4", "E4", "G#4"), ("A3", "C#4", "E4"))
    for k in range(4):
        for j in range(4):
            at = (k * 8 + j * 2) * s16
            tri.play(at, s16 * 0.9, roots[k] if j % 2 == 0 else up(roots[k]), wrap=True)
        for j in range(4):
            arp.play((k * 8 + j * 2) * s16, s16 * 1.6, chords[k][(0, 1, 2, 1)[j]], vol=0.22, decay=0.12, wrap=True)
    # The triangle kick, on the one of each bar only: soft, and it cuts the bass for a moment.
    for beat in (0, 16):
        tri.play(beat * s16, 0.035, lambda t: 240.0 * 2.0 ** (-t / 0.012) + 45.0, wrap=True)

    tune = ("E5 . G#5 . B5 - - . D#5 . F#5 . B5 - - . "
            "C#5 . E5 . G#5 - E5 . C#5 . E5 . A5 - - .")
    for i, tok, hold in steps(tune):
        dur = hold * s16 * 0.95
        lead.play(i * s16, dur, tok, vol=0.5, decay=dur * 1.8, vibrato=0.2 if hold > 1 else 0.0, wrap=True)
        echo.play(i * s16 + 3 / 60.0, dur, tok, vol=0.14, decay=dur * 1.8, wrap=True)

    for i in range(2, 32, 4):
        noi.play(i * s16, 0.03, 0.0, vol=0.14, decay=0.03, setting=1, wrap=True)
    for i in (8, 24):
        noi.play(i * s16, 0.1, 0.0, vol=0.28, decay=0.1, setting=6, wrap=True)
    return mixdown([lead, echo, arp, tri, noi], loop=True)


def bloop_ringback() -> np.ndarray:
    """One slow bar: a triangle bass note and a couple of soft bubbles. No drums; loops."""
    s16 = 60.0 / 88.0 / 4.0
    secs = 16 * s16
    lead = Channel("pulse", secs, duty=2)
    echo = Channel("pulse", secs, duty=2)
    tri = Channel("triangle", secs)
    tri.play(0.0, 6 * s16, "E2", wrap=True)
    tri.play(8 * s16, 6 * s16, "B1", wrap=True)
    for i, tok, hold in steps("B5 . . E5 . . . . G#5 . . B5 . . . ."):
        dur = max(hold, 2) * s16
        lead.play(i * s16, dur, tok, vol=0.34, decay=dur * 1.6, wrap=True)
        echo.play(i * s16 + 3 / 60.0, dur, tok, vol=0.1, decay=dur * 1.6, wrap=True)
    return mixdown([lead, echo, tri], loop=True)


# ── Glass: Mega Drive ────────────────────────────────────────────────────────────────────────
def glass_ring() -> np.ndarray:
    """E then C#m to A at 100 bpm: slap bass, FM bubbles and a bell over a string pad and a soft kit."""
    s16 = 60.0 / 100.0 / 4.0
    m = Mix(32 * s16)

    def bass(tok, at, dur, i):
        m.note(SLAP, tok, at, dur * 0.8, gain=0.5, level=1.0 if i % 4 == 0 else 0.8, tail=0.14, wrap=True)

    for bar, line in enumerate(("E2 . . E3 . . E2 . B1 . . D2 . E2 G2 .",
                                "C#2 . . C#3 . . C#2 . A1 . . B1 . C#2 E2 .")):
        for i, tok, hold in steps(line):
            bass(tok, (bar * 16 + i) * s16, hold * s16, i)

    for at, dur, chord in ((0, 16, ("E4", "G#4", "B4")), (16, 8, ("C#4", "E4", "G#4")), (24, 8, ("A3", "C#4", "E4"))):
        for n in chord:
            m.note(STRINGS, n, at * s16, dur * s16 * 0.95, gain=0.14, tail=0.2, wrap=True)

    tune = ("B5 . . G#5 . E5 . . G#5 . . B5 - - . . "
            "C#6 . . B5 . G#5 . . E5 . . G#5 - - . .")
    for i, tok, hold in steps(tune):
        m.note(BLIP, tok, i * s16, 0.06, gain=0.55, tail=0.3, wrap=True)
        if hold > 1:
            m.note(BELL, up(tok), i * s16, hold * s16 * 0.6, gain=0.07, tail=0.4, wrap=True)

    for bar in (0, 1):
        base = bar * 16
        for i in (0, 10):
            m.note(KICK, 60.0, (base + i) * s16, s16, gain=0.4, tail=0.15, wrap=True)
        for i in (4, 12):
            m.note(SNARE, 200.0, (base + i) * s16, s16, gain=0.28, tail=0.12, wrap=True)
        for i in range(0, 16, 2):
            m.note(HAT, 8000.0, (base + i) * s16, s16 * 0.4, gain=0.12 if i % 4 else 0.18, tail=0.04, wrap=True)
    return m.buf


def glass_ringback() -> np.ndarray:
    """One bar: a sparse slap bass line, two bubbles and a bell; loops."""
    s16 = 60.0 / 92.0 / 4.0
    m = Mix(16 * s16)
    for i, tok, hold in steps("E2 . . . . . E3 . B1 . . . . . . ."):
        m.note(SLAP, tok, i * s16, hold * s16 * 0.8, gain=0.4, tail=0.14, wrap=True)
    for i, tok, hold in steps("B5 . . E5 . . . . . . . . . . . ."):
        m.note(BLIP, tok, i * s16, 0.06, gain=0.45, tail=0.35, wrap=True)
    m.note(BELL, "E5", 0.0, 0.3, gain=0.07, tail=0.5, wrap=True)
    m.note(BELL, "B4", 8 * s16, 0.3, gain=0.06, tail=0.5, wrap=True)
    return m.buf


# ── Glass, darker: two takes on "mysterious" ─────────────────────────────────────────────────
CHOIR, MARIMBA, TOM = P["choir"], P["marimba"], P["md-tom"]


def echoed(m: Mix, patch, note, at, dur, gain, tail, delay=0.28, loops=3, fade=0.38):
    """A note, then its echoes a beat apart, each quieter: the room the sound is in."""
    for k in range(loops):
        m.note(patch, note, at + k * delay, dur, gain=gain * fade ** k, tail=tail, wrap=True)


def glass_mystery_ring() -> np.ndarray:
    """E phrygian at 78 bpm: a low slap, a choir held under it, and a bell tune that echoes away."""
    s16 = 60.0 / 78.0 / 4.0
    m = Mix(32 * s16)
    for i, tok, hold in steps("E2 . . . . . E2 . . . . . F2 . . . E2 . . . . . E2 . . . . . B1 . . ."):
        m.note(SLAP, tok, i * s16, hold * s16 * 0.8, gain=0.42, level=1.0, tail=0.2, wrap=True)
    # E minor with the flat nine in it (F), then a half step back down.
    for at, dur, chord in ((0, 16, ("E3", "G3", "B3", "F4")), (16, 16, ("E3", "G3", "B3", "D4"))):
        for n in chord:
            m.note(CHOIR, n, at * s16, dur * s16 * 0.95, gain=0.12, tail=0.3, wrap=True)
    tune = "B5 . . . . . C6 . . . . . B5 . . . G5 . . . . . A5 . . . . . B5 . . ."
    for i, tok, hold in steps(tune):
        echoed(m, BELL, tok, i * s16, hold * s16, 0.12, 0.6, delay=s16 * 3)
    # A slow heartbeat on the tom, once a bar.
    for at in (0, 16):
        m.note(TOM, "E2", at * s16, s16, gain=0.3, tail=0.3, wrap=True)
    return m.buf


def glass_noir_ring() -> np.ndarray:
    """A minor at 70 bpm, slow and sparse: marimba and a tritone, bass notes few and far between."""
    s16 = 60.0 / 70.0 / 4.0
    m = Mix(32 * s16)
    for i, tok, hold in steps("A1 . . . . . . . . . E2 . . . . . . . . . . . A1 . . . . . D#2 . . ."):
        m.note(SLAP, tok, i * s16, hold * s16 * 0.8, gain=0.4, level=1.0, tail=0.25, wrap=True)
    for at, dur, chord in ((0, 24, ("A3", "C4", "E4")), (24, 8, ("A3", "C4", "D#4"))):
        for n in chord:
            m.note(STRINGS, n, at * s16, dur * s16 * 0.95, gain=0.1, tail=0.4, wrap=True)
    tune = "E5 . . . A5 . . . . . . . D#5 . . . . . . . E5 . . . . . G5 . . . F#5 . ."
    for i, tok, hold in steps(tune):
        echoed(m, MARIMBA, tok, i * s16, hold * s16, 0.35, 0.4, delay=s16 * 2, loops=2, fade=0.3)
    m.note(BELL, "A5", 0.0, 0.3, gain=0.07, tail=0.8, wrap=True)
    return m.buf


def glass_mystery_ringback() -> np.ndarray:
    """One bar at 70 bpm: a held choir note and two bells far apart; loops."""
    s16 = 60.0 / 70.0 / 4.0
    m = Mix(16 * s16)
    for n in ("E3", "B3"):
        m.note(CHOIR, n, 0.0, 14 * s16, gain=0.1, tail=0.4, wrap=True)
    echoed(m, BELL, "B5", 0.0, 0.3, 0.1, 0.6, delay=s16 * 3, loops=2)
    echoed(m, BELL, "G5", 8 * s16, 0.3, 0.09, 0.6, delay=s16 * 3, loops=2)
    return m.buf


def glass_noir_ringback() -> np.ndarray:
    """One bar: a low slap and one marimba note that echoes; loops."""
    s16 = 60.0 / 66.0 / 4.0
    m = Mix(16 * s16)
    m.note(SLAP, "A1", 0.0, 4 * s16, gain=0.38, tail=0.25, wrap=True)
    echoed(m, MARIMBA, "E5", 4 * s16, 0.1, 0.3, 0.4, delay=s16 * 2, loops=3, fade=0.4)
    return m.buf


# ── Glass, bubbly again: Bloop's key and tempo, a tighter bass, and a layer from another chip ──
BUBBLE = _md.BUBBLE
GLASS_ROOTS = ("E2", "B1", "C#2", "A1")
GLASS_FIFTHS = ("B2", "F#2", "G#2", "E2")
GLASS_CHORDS = (("E4", "G#4", "B4"), ("B3", "D#4", "F#4"), ("C#4", "E4", "G#4"), ("A3", "C#4", "E4"))
GLASS_TUNE = ("G#5 . B5 . E6 - . . D#6 . B5 . F#5 - . . "
              "E5 . G#5 . C#6 - G#5 . A5 . C#6 . E6 - - .")
BPM = 104.0


def glass_base(layer: str | None) -> np.ndarray:
    """Bubbles over a slap bass and a light kit; *layer* adds NES or SMS on top."""
    s16 = 60.0 / BPM / 4.0
    secs = 32 * s16
    m = Mix(secs)
    for k in range(4):
        base = k * 8
        # root, an octave up on the "and", the root again, the fifth to turn round
        for step, note, hold, level in ((0, GLASS_ROOTS[k], 2, 1.0), (3, up(GLASS_ROOTS[k]), 1, 0.8),
                                        (5, GLASS_ROOTS[k], 1, 0.8), (7, GLASS_FIFTHS[k], 1, 0.7)):
            m.note(SLAP, note, (base + step) * s16, hold * s16 * 0.8, gain=0.5, level=level, tail=0.12, wrap=True)
        for n in GLASS_CHORDS[k]:
            m.note(STRINGS, n, base * s16, 8 * s16 * 0.95, gain=0.1, tail=0.2, wrap=True)
    for i, tok, hold in steps(GLASS_TUNE):
        m.note(BUBBLE, tok, i * s16, hold * s16 * 0.8, gain=0.5, tail=0.25, wrap=True)
        if hold > 1:
            m.note(BELL, up(tok), i * s16, hold * s16 * 0.5, gain=0.06, tail=0.35, wrap=True)
    for i in (0, 16):
        m.note(KICK, 60.0, i * s16, s16, gain=0.4, tail=0.15, wrap=True)
    for i in (8, 24):
        m.note(SNARE, 200.0, i * s16, s16, gain=0.22, tail=0.12, wrap=True)
    if layer is None:
        for i in range(2, 32, 4):
            m.note(HAT, 8000.0, i * s16, s16 * 0.4, gain=0.14, tail=0.04, wrap=True)
        return m.buf
    if layer == "nes":
        # The NES's own kit and a soft hollow arpeggio under the bubbles.
        arp = Channel("pulse", secs, duty=3)
        noi = Channel("noise", secs, setting=1)
        for k in range(4):
            for j in range(4):
                arp.play((k * 8 + j * 2) * s16, s16 * 1.6, GLASS_CHORDS[k][(0, 1, 2, 1)[j]],
                         vol=0.2, decay=0.12, wrap=True)
        for i in range(2, 32, 4):
            noi.play(i * s16, 0.03, 0.0, vol=0.14, decay=0.03, setting=1, wrap=True)
        return stack(secs, m.buf, mixdown([arp, noi], loop=True))
    # The Master System: two squares a few cents apart doubling the tune an octave down.
    a, b = Chan("tone", secs), Chan("tone", secs)
    noi = Chan("noise", secs)
    for i, tok, hold in steps(GLASS_TUNE):
        dur = hold * s16 * 0.9
        a.play(i * s16, dur, up(tok, -1), vol=0.3, decay=dur * 1.6, detune=9, vibrato=0.2, wrap=True)
        b.play(i * s16, dur, up(tok, -1), vol=0.18, decay=dur * 1.6, detune=-9, vibrato=0.2, wrap=True)
    for i in range(2, 32, 4):
        noi.play(i * s16, 0.03, 0.0, vol=0.22, decay=0.03, setting=0, wrap=True)
    return stack(secs, m.buf, smix([a, b], noi))


def glass_back(layer: str | None) -> np.ndarray:
    """One bar: a slap bass pair, two bubbles and a bell, with the layer's soft part if any."""
    s16 = 60.0 / 88.0 / 4.0
    secs = 16 * s16
    m = Mix(secs)
    m.note(SLAP, "E2", 0.0, 2 * s16, gain=0.4, tail=0.14, wrap=True)
    m.note(SLAP, "B1", 8 * s16, 2 * s16, gain=0.35, tail=0.14, wrap=True)
    for i, tok, hold in steps("B5 . . E5 . . . . G#5 . . B5 . . . ."):
        m.note(BUBBLE, tok, i * s16, 0.1, gain=0.4, tail=0.25, wrap=True)
    m.note(BELL, "E6", 0.0, 0.3, gain=0.05, tail=0.4, wrap=True)
    if layer is None:
        return m.buf
    if layer == "nes":
        lead = Channel("pulse", secs, duty=2)
        for i, tok, hold in steps("B5 . . E5 . . . . G#5 . . B5 . . . ."):
            lead.play(i * s16 + 3 / 60.0, 2 * s16, tok, vol=0.1, decay=0.3, wrap=True)
        return stack(secs, m.buf, mixdown([lead], loop=True))
    a, b = Chan("tone", secs), Chan("tone", secs)
    for i, tok, hold in steps("B4 . . . . . . . . . . . . . . ."):
        a.play(i * s16, 14 * s16, tok, vol=0.14, detune=9, vibrato=0.2, wrap=True)
        b.play(i * s16, 14 * s16, tok, vol=0.09, detune=-9, vibrato=0.2, wrap=True)
    return stack(secs, m.buf, smix([a, b]))


SOUNDS = {
    "2-bloop": {"ring": bloop_ring, "ringback": bloop_ringback},
    "3-glass": {
        "ring": glass_ring,
        "ringback": glass_ringback,
        "ring-mystery": glass_mystery_ring,
        "ringback-mystery": glass_mystery_ringback,
        "ring-noir": glass_noir_ring,
        "ringback-noir": glass_noir_ringback,
        "ring-b1-md": lambda: glass_base(None),
        "ringback-b1-md": lambda: glass_back(None),
        "ring-b2-nes": lambda: glass_base("nes"),
        "ringback-b2-nes": lambda: glass_back("nes"),
        "ring-b3-sms": lambda: glass_base("sms"),
        "ringback-b3-sms": lambda: glass_back("sms"),
    },
}

if __name__ == "__main__":
    out = Path(sys.argv[1])
    for pack, sounds in SOUNDS.items():
        (out / pack).mkdir(parents=True, exist_ok=True)
        for kind, fn in sounds.items():
            y = finish(fn(), kind.split("-")[0])
            write_wav(out / pack / f"{kind}-song.wav", y)
            print(f"{pack:8s} {kind:9s} {len(y) / SR:4.2f}s")
