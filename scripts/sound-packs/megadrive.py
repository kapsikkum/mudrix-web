"""Render Mudrix's "Mega Drive" notification pack through the ytpmv YM2612 model.

Needs the YM2612 model from the michael-rosen-says repo (app.ytpmv.ym2612). From that repo root:
    PYTHONPATH=. python <this file> <out_dir> [sound ...]
Writes one WAV per sound into out_dir; encode with ffmpeg -c:a libmp3lame -b:a 160k.
"""

from __future__ import annotations

import sys
import wave
from dataclasses import replace
from pathlib import Path

import numpy as np

from app.ytpmv import ym2612 as chip
from app.ytpmv.ym2612 import Op, Patch, render_note

SR = chip.SR
P = chip.PATCHES


def hz(note: str) -> float:
    """'E2', 'G#5', 'Bb3' -> Hz."""
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[note[0]]
    rest = note[1:]
    if rest[0] == "#":
        n += 1
        rest = rest[1:]
    elif rest[0] == "b":
        n -= 1
        rest = rest[1:]
    midi = n + 12 * (int(rest) + 1)
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


class Mix:
    def __init__(self, seconds: float):
        self.buf = np.zeros(int(round(seconds * SR)), dtype=np.float64)

    def add(self, y: np.ndarray, at: float, gain: float = 1.0, wrap: bool = False) -> None:
        start = int(round(at * SR))
        if wrap:
            # Loops: whatever runs past the end comes back in at the start, so the seam is seamless.
            idx = (start + np.arange(len(y))) % len(self.buf)
            np.add.at(self.buf, idx, y * gain)
            return
        end = min(len(self.buf), start + len(y))
        if end > start:
            self.buf[start:end] += y[: end - start] * gain

    def note(self, patch: Patch, note: str | float, at: float, dur: float, gain: float = 1.0,
             level: float = 1.0, tail: float = 0.25, wrap: bool = False) -> None:
        f = note if isinstance(note, float) else hz(note)
        self.add(render_note(patch, f, dur, SR, level=level, tail=tail), at, gain, wrap)


# ── Voices ────────────────────────────────────────────────────────────────────

# Sonic 2's slap bass with the driver's slide onto the note: a quick pitch snap
# down from a little sharp is the "slap". Played low, it is the deep one.
SLAP = replace(P["bass"], name="slap", bend=2.0, bend_time=0.012, gain=1.0)

# A short glassy blip for the message ping: two modulator/carrier pairs, the
# upper one a fifth-ish partial for sparkle, all of it gone in ~200 ms.
BLIP = Patch(
    "blip", "notification blip", alg=4, fb=3, gain=2.2,
    ops=(
        Op(mul=3, tl=34, ar=31, d1r=22, sl=15, rr=14, ks=2),
        Op(mul=1, tl=6, ar=31, d1r=9, sl=5, d2r=7, rr=6, ks=1),
        Op(mul=7, tl=44, ar=31, d1r=24, sl=15, rr=14, ks=2),
        Op(mul=2, tl=20, ar=31, d1r=11, sl=7, d2r=8, rr=7, ks=1),
    ))

# A round, bubbly tone for the outgoing ring: one gentle modulator for a "bwop" at the front that
# is gone almost at once, over a near-sine carrier, scooped up onto the note like a bubble.
BUBBLE = Patch(
    "bubble", "a round little bubble", alg=4, fb=0, gain=2.6, bend=-2.0, bend_time=0.015,
    ops=(Op(tl=127), Op(tl=127),
         Op(mul=2, tl=34, ar=31, d1r=20, sl=15, rr=14, ks=1),
         Op(mul=1, tl=2, ar=31, d1r=6, sl=3, d2r=6, rr=9, ks=1)))

# A pure sine (one carrier, nothing feeding it): the phone tones.
SINE = Patch(
    "sine", "pure tone", alg=7, fb=0, gain=4.0,
    ops=(Op(tl=127), Op(tl=127), Op(tl=127), Op(mul=1, tl=0, ar=31, d1r=0, sl=0, rr=12)))

BELL = P["bell"]
LEAD = P["lead"]
KICK, SNARE, HAT = P["md-kick"], P["md-snare"], P["md-hat"]


# ── Sounds ────────────────────────────────────────────────────────────────────

def message() -> np.ndarray:
    m = Mix(0.6)
    m.note(BLIP, "B4", 0.0, 0.06, gain=0.85, tail=0.25)
    m.note(BLIP, "E5", 0.075, 0.1, tail=0.45)
    return m.buf


def mention() -> np.ndarray:
    m = Mix(0.95)
    m.note(SLAP, "E2", 0.0, 0.14, gain=0.6, tail=0.3)
    for i, n in enumerate(("E4", "G#4", "B4")):
        m.note(BLIP, n, 0.06 * i, 0.05, gain=0.85, tail=0.3)
    m.note(BELL, "E5", 0.18, 0.25, gain=0.3, tail=0.45)
    return m.buf


def callend() -> np.ndarray:
    m = Mix(1.1)
    for i, n in enumerate(("B5", "G#5", "E5")):
        m.note(BLIP, n, 0.09 * i, 0.07, gain=0.8, tail=0.3)
    # The drop: the slap from E2 down to E1 an instant later, the deep one.
    m.note(SLAP, "E2", 0.27, 0.06, gain=0.45, tail=0.12)
    m.note(SLAP, "E1", 0.34, 0.14, gain=0.6, tail=0.3)
    return m.buf


def _steps(m: Mix, line: str, s16: float, bar: int, play) -> None:
    """A tracker line: one token per 16th, '.' rests, '-' holds the note before it."""
    toks = line.split()
    for i, tok in enumerate(toks):
        if tok in (".", "-"):
            continue
        hold = 1
        while i + hold < len(toks) and toks[i + hold] == "-":
            hold += 1
        play(tok, (bar * 16 + i) * s16, hold * s16, i)


def ring() -> np.ndarray:
    """Two bars at 140 bpm in the manner of Sonic 2's Emerald Hill and Chemical Plant; loops.

    An original tune, written from those zones' habits rather than their notes: Emerald Hill's
    octave-bouncing bass with a run-up at the end of the bar, its sustained pad, a lead pushing
    on the offbeats and a kick on the "and" of three; Chemical Plant's sixteenth-note ostinato
    made of two channels a sixteenth apart, brass stabs that anticipate the beat, and ghost-note
    snare pickups. D mixolydian, I - bVII - IV.
    """
    s16 = 60.0 / 140.0 / 4.0
    m = Mix(32 * s16)
    brass, pad, osti = P["brass"], P["strings"], P["square-lead"]
    tom = replace(P["md-tom"], base_hz=0.0)
    up = lambda n, k=1: n[:-1] + str(int(n[-1]) + k)

    # Bass: the bounce, and a run-up back into D at the end.
    def slap(tok, at, dur, i):
        m.note(SLAP, tok, at, dur * 0.8, gain=0.5, level=1.0 if i % 4 == 0 else 0.8,
               tail=0.12, wrap=True)

    _steps(m, "D2 . D3 . D2 . D3 . D2 . D3 . A1 . D3 .", s16, 0, slap)
    _steps(m, "C2 . C3 . C2 . C3 . G1 . G2 . A1 B1 C#2 .", s16, 1, slap)

    # The ostinato: an octave pair on the chord root every sixteenth, split across two
    # channels a sixteenth apart, the way Chemical Plant gets its churn.
    roots = ["D4"] * 16 + ["C4"] * 8 + ["G3"] * 8
    for i, r in enumerate(roots):
        n = r if i % 2 == 0 else up(r)
        m.note(osti, n, i * s16, s16 * 0.6, gain=0.3 if i % 2 else 0.36, tail=0.05, wrap=True)

    # Pad under it all: D, then C to G.
    for at, dur, chord in ((0, 16, ("D4", "F#4", "A4")), (16, 8, ("C4", "E4", "G4")),
                           (24, 8, ("B3", "D4", "G4"))):
        for n in chord:
            m.note(pad, n, at * s16, dur * s16 * 0.95, gain=0.3, tail=0.2, wrap=True)

    # Brass stabs, pushed: on the one, and anticipating beat three on the sixteenth before.
    stabs = [(0, ("D4", "F#4", "A4")), (7, ("D4", "F#4", "A4")), (12, ("D4", "F#4", "A4")),
             (16, ("C4", "E4", "G4")), (23, ("B3", "D4", "G4")), (28, ("B3", "D4", "G4")),
             (31, ("D4", "F#4", "A4"))]
    for step, chord in stabs:
        for n in chord:
            m.note(brass, n, step * s16, s16 * 0.9, gain=0.28, tail=0.08, wrap=True)

    # Lead: stepwise, pushing on the offbeats, a bell an octave up for the shine.
    def lead(tok, at, dur, i):
        m.note(LEAD, tok, at, dur * 0.92, gain=0.5, tail=0.12, wrap=True)
        m.note(BELL, up(tok), at, dur * 0.5, gain=0.06, tail=0.15, wrap=True)

    _steps(m, "A4 . . D5 . . E5 . F#5 - E5 D5 . E5 - .", s16, 0, lead)
    _steps(m, "E5 . . D5 . C5 - . B4 . . D5 - - . .", s16, 1, lead)

    # Drums: kick on the one, the and-of-two and the and-of-three; snare on two and four with
    # ghosted pickups; sixteenth hats leaning on the eighths; a tom fill to close; crash on the one.
    for bar in (0, 1):
        base = bar * 16
        for i in (0, 7, 10):
            m.note(KICK, 60.0, (base + i) * s16, s16, gain=0.6, tail=0.15, wrap=True)
        for i in (4, 12):
            m.note(SNARE, 200.0, (base + i) * s16, s16, gain=0.55, tail=0.15, wrap=True)
        if bar == 0:
            m.note(SNARE, 200.0, (base + 15) * s16, s16, gain=0.18, tail=0.1, wrap=True)
        for i in range(16 if bar == 0 else 13):
            m.note(HAT, 8000.0, (base + i) * s16, s16 * 0.4,
                   gain=0.3 if i % 2 == 0 else 0.15, tail=0.04, wrap=True)
    for k, n in enumerate(("A3", "F#3", "D3")):
        m.note(tom, n, (29 + k) * s16, s16, gain=0.5, tail=0.15, wrap=True)
    m.note(P["md-cymbal"], 1100.0, 0.0, s16 * 4, gain=0.2, tail=0.3, wrap=True)
    return m.buf


def ringback() -> np.ndarray:
    """The outgoing ring: Skype-style bubbles, a call and answer, over a slap-bass groove; loops.

    Not Skype's tune, just its manner -- round little FM bubbles a third apart, a call and its
    answer, then a gap -- remixed over the pack's slap bass at 100 bpm, one bar a loop.
    """
    bpm = 100.0
    s16 = 60.0 / bpm / 4.0
    m = Mix(16 * s16)
    # The two bursts, as a call and its answer: a rising "doo-dee", then a falling "dee-doo".
    for start, notes in ((0.0, ("E5", "G#5")), (4 * s16, ("B5", "G#5"))):
        m.note(BUBBLE, notes[0], start, 0.16, gain=0.6, tail=0.12, wrap=True)
        m.note(BUBBLE, notes[1], start + 0.19, 0.22, gain=0.6, tail=0.3, wrap=True)
    bass = "E2 . . E3 . . E2 . B1 . . D2 . E2 G2 ."
    for i, tok in enumerate(bass.split()):
        if tok != ".":
            m.note(SLAP, tok, i * s16, s16 * 0.7, gain=0.7, level=1.0 if i % 4 == 0 else 0.8,
                   tail=0.18, wrap=True)
    for i in (0, 7, 10):
        m.note(KICK, 60.0, i * s16, s16, gain=0.6, tail=0.15, wrap=True)
    for i in (4, 12):
        m.note(SNARE, 200.0, i * s16, s16, gain=0.3, tail=0.12, wrap=True)
    for i in range(0, 16, 2):
        m.note(HAT, 8000.0, i * s16, s16 * 0.5, gain=0.14, tail=0.05, wrap=True)
    return m.buf


def blip_pair(a: str, b: str, gap: float = 0.07) -> np.ndarray:
    m = Mix(0.4)
    m.note(BLIP, a, 0.0, 0.04, gain=0.8, tail=0.22)
    m.note(BLIP, b, gap, 0.05, gain=0.8, tail=0.25)
    return m.buf


def walk(up: bool) -> np.ndarray:
    """Three FM blips stepping up (someone arrives) or down (someone goes)."""
    m = Mix(0.5)
    notes = ["A5", "C#6", "E6"] if up else ["E6", "C#6", "A5"]
    for i, n in enumerate(notes):
        m.note(BLIP, n, i * 0.06, 0.04, gain=0.8, tail=0.3 if i == 2 else 0.18)
    return m.buf


def warp() -> np.ndarray:
    """Carried to another room: FM blips dipping down, then leaping up past where they began."""
    m = Mix(0.6)
    for i, n in enumerate(["E6", "A5", "E6", "A6"]):
        m.note(BLIP, n, i * 0.06, 0.04, gain=0.8, tail=0.3 if i == 3 else 0.18)
    return m.buf


def showtime() -> np.ndarray:
    """Watch together starts: FM blips running up an A major arpeggio, a bell ringing under the last."""
    m = Mix(1.0)
    notes = ["A5", "C#6", "E6", "A6"]
    for i, n in enumerate(notes):
        m.note(BLIP, n, i * 0.055, 0.04, gain=0.8, tail=0.45 if i == len(notes) - 1 else 0.18)
    m.note(BELL, "A4", 0.165, 0.3, gain=0.25, tail=0.55)
    return m.buf


SOUNDS = {
    "message": message,
    "mention": mention,
    "ring": ring,
    "ringback": ringback,
    "callend": callend,
    "unmute": lambda: blip_pair("A5", "E6"),
    "mute": lambda: blip_pair("E6", "A5"),
    "camera-on": lambda: blip_pair("E5", "B5", 0.05),
    "camera-off": lambda: blip_pair("B5", "E5", 0.05),
    "join": lambda: walk(True),
    "leave": lambda: walk(False),
    "moved": warp,
    "watch-together-start": showtime,
}

# Peak targets in dBFS. Loops and the bass-heavy ones run a little hotter in
# RMS anyway; these keep the short blips from jumping out of the speakers.
PEAK_DB = {"message": -3.0, "mention": -2.0, "ring": -1.5, "ringback": -3.0, "callend": -2.0}


# One-shots are levelled by how loud they sound, not by their peak: the loudest 100 ms of each,
# in dB RMS, set to sit with the other packs (Element, Cinny, FluffyChat sit around -14 to -18).
LOUDNESS_DB = {"message": -17.0, "mention": -16.0, "callend": -17.0}
VOICE_LOUDNESS_DB = -18.0
PEAK_CEILING_DB = -3.0


def loudest_100ms_db(y: np.ndarray) -> float:
    w = int(0.1 * SR)
    if len(y) < w:
        return 10 * np.log10(np.mean(y ** 2) + 1e-12)
    return 10 * np.log10(np.convolve(y ** 2, np.ones(w) / w, "valid").max() + 1e-12)


def level_one_shot(y: np.ndarray, name: str) -> np.ndarray:
    target = LOUDNESS_DB.get(name, VOICE_LOUDNESS_DB)
    y = y * 10 ** ((target - loudest_100ms_db(y)) / 20.0)
    ceiling = 10 ** (PEAK_CEILING_DB / 20.0)
    peak = np.max(np.abs(y))
    return y * (ceiling / peak) if peak > ceiling else y

def finish(y: np.ndarray, name: str, loop: bool) -> np.ndarray:
    # No DC removal here: the chip model already high-passes its output (the console's coupling
    # capacitor), and subtracting a mean would put an offset under the silences of the loops.
    # Gentle soft clip so stacked FM peaks round over instead of splattering.
    peak = np.max(np.abs(y)) or 1.0
    y = np.tanh(1.2 * y / peak) / np.tanh(1.2)
    target = 10 ** (PEAK_DB.get(name, -4.0) / 20.0)
    y = y / (np.max(np.abs(y)) or 1.0) * target
    if name == "ringback":
        # Its loop restarts on a tone after silence; a few ms of fade-in keeps that from ticking.
        edge = int(0.003 * SR)
        y[:edge] *= np.linspace(0.0, 1.0, edge)
    if not loop:
        # Trim trailing near-silence, then a short fade so nothing ends on a step.
        thresh = 10 ** (-60 / 20) * target
        nz = np.nonzero(np.abs(y) > thresh)[0]
        y = y[: (nz[-1] + 1 if len(nz) else len(y))]
        edge = min(len(y), int(0.01 * SR))
        y[-edge:] *= np.linspace(1.0, 0.0, edge)
    return y if loop else level_one_shot(y, name)


def write_wav(path: Path, y: np.ndarray) -> None:
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    for name, fn in SOUNDS.items():
        if only and name not in only:
            continue
        y = finish(fn(), name, loop=name in ("ring", "ringback"))
        write_wav(out / f"{name}.wav", y)
        print(f"{name:11s} {len(y) / SR:5.2f}s  peak {20 * np.log10(np.max(np.abs(y))):6.1f} dBFS  "
              f"rms {20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-12):6.1f} dBFS")


if __name__ == "__main__":
    main()
