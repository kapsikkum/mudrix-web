"""Render Mudrix's "Mega Drive 2" notification pack: the YM2612 plus the console's own SN76489.

Needs the michael-rosen-says repo (app.ytpmv.ym2612, app.ytpmv.sms). From that repo root:
    PYTHONPATH=. python <this file> <out_dir> [sound ...]

The first Mega Drive pack is slap bass, bubbles and Sonic. This one is the console's other
side: the FM electric piano, marimba, drawbar organ and choir, an FM synth bass, and the hats
off the PSG -- the SN76489 every Mega Drive also carries, which composers used for exactly
that while the FM did the rest. The ring is the club end of the library: four-on-the-floor
house in the manner of Streets of Rage, not a zone theme.
"""

from __future__ import annotations

import importlib.util
import os
import sys
from dataclasses import replace

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _common import SR, hz, run, up  # noqa: E402

from app.ytpmv import sms  # noqa: E402

_spec = importlib.util.spec_from_file_location("mdpack", os.path.join(HERE, "megadrive.py"))
_md = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_md)
Mix, P = _md.Mix, _md.P

EP, MARIMBA, ORGAN, CHOIR = P["piano"], P["marimba"], P["organ"], P["choir"]
SYNTH_BASS, KICK, SNARE, PERC = P["synth-bass"], P["md-kick"], P["md-snare"], P["md-perc"]


def psg_hat(m: Mix, at: float, dur: float, gain: float, open_: bool = False, wrap: bool = False):
    """A hat off the PSG's noise channel rather than the FM."""
    v = replace(sms.VOICES["sms-hat"], decay=0.16 if open_ else 0.03)
    m.add(sms.render_note(v, 8000.0, dur if not open_ else 0.18, SR), at, gain, wrap)


# ── Sounds ────────────────────────────────────────────────────────────────────

def message() -> np.ndarray:
    """A soft electric-piano dyad, a sixth wide, struck once."""
    m = Mix(0.9)
    for n in ("G4", "E5"):
        m.note(EP, n, 0.0, 0.25, gain=0.5, tail=0.5)
    return m.buf


def mention() -> np.ndarray:
    """Marimba running up a triad, answered by the chord on the electric piano."""
    m = Mix(1.0)
    for i, n in enumerate(("G4", "C5", "E5")):
        m.note(MARIMBA, n, i * 0.055, 0.08, gain=0.6, tail=0.25)
    for n in ("C4", "E4", "G4", "C5"):
        m.note(EP, n, 0.17, 0.3, gain=0.28, tail=0.45)
    return m.buf


def ring() -> np.ndarray:
    """Two bars of FM house at 125 bpm, A minor: Am7, then Fmaj7 to G; loops.

    Kick on every beat and snare on two and four off the DAC, PSG hats (closed sixteenths, open
    on the offbeats), an FM synth bass on the off-beat eighths, organ stabs pushed off the beat,
    a choir pad underneath and a short electric-piano hook in the back half of each bar.
    """
    s16 = 60.0 / 125.0 / 4.0
    m = Mix(32 * s16)
    chords = {0: ("A3", "C4", "E4", "G4"), 1: ("F3", "A3", "C4", "E4"), 2: ("G3", "B3", "D4", "G4")}

    for beat in range(8):
        m.note(KICK, 60.0, beat * 4 * s16, s16, gain=0.45, tail=0.15, wrap=True)
        if beat % 2 == 1:
            m.note(SNARE, 200.0, beat * 4 * s16, s16, gain=0.45, tail=0.15, wrap=True)
        psg_hat(m, (beat * 4 + 2) * s16, s16, 0.22, open_=True, wrap=True)
    for i in range(32):
        if i % 4 != 2:
            psg_hat(m, i * s16, s16 * 0.4, 0.12 if i % 2 else 0.16, wrap=True)

    # Off-beat bass: the "and" of every beat, root then octave.
    roots = ["A1"] * 4 + ["F1"] * 2 + ["G1"] * 2
    for beat, r in enumerate(roots):
        n = r if beat % 2 == 0 else up(r)
        m.note(SYNTH_BASS, up(n), (beat * 4 + 2) * s16, s16 * 1.6, gain=0.5, tail=0.1, wrap=True)

    # Organ stabs, pushed off the beat.
    for bar in (0, 1):
        for i in (3, 6, 10, 14):
            chord = chords[0] if bar == 0 else (chords[1] if i < 8 else chords[2])
            for n in chord:
                m.note(ORGAN, n, (bar * 16 + i) * s16, s16 * 0.9, gain=0.16, tail=0.06, wrap=True)
        pad = chords[0] if bar == 0 else chords[1]
        for n in pad:
            m.note(CHOIR, up(n), bar * 16 * s16, 15 * s16, gain=0.22, tail=0.2, wrap=True)

    # The hook: three notes in the back half of each bar.
    for step, n, length in ((8, "E5", 1), (10, "G5", 1), (11, "A5", 4),
                            (24, "G5", 1), (26, "F5", 1), (27, "E5", 4)):
        m.note(EP, n, step * s16, length * s16 * 0.9, gain=0.55, tail=0.25, wrap=True)
    return m.buf


def ringback() -> np.ndarray:
    """Two soft choir swells on an A minor ninth, and a gap; loops."""
    m = Mix(3.2)
    for at in (0.0, 0.8):
        for n in ("A3", "E4", "G4", "B4", "C5"):
            m.note(CHOIR, n, at, 0.55, gain=0.2, tail=0.15, wrap=True)
    return m.buf


def callend() -> np.ndarray:
    """An FM swoop two octaves down onto A2, and a low electric-piano chord to close."""
    m = Mix(1.1)
    swoop = replace(SYNTH_BASS, bend=24.0, bend_time=0.09)
    m.note(swoop, "A2", 0.0, 0.32, gain=0.55, tail=0.15)
    for n in ("A3", "C4", "E4"):
        m.note(EP, n, 0.3, 0.35, gain=0.3, tail=0.45)
    return m.buf


def ep_note(note: str) -> np.ndarray:
    m = Mix(0.6)
    m.note(EP, note, 0.0, 0.12, gain=0.6, tail=0.35)
    return m.buf


def shutter(up_: bool) -> np.ndarray:
    m = Mix(0.4)
    m.note(PERC, 420.0, 0.0, 0.03, gain=0.7, tail=0.05)
    m.note(MARIMBA, "E5" if up_ else "A4", 0.04, 0.08, gain=0.55, tail=0.22)
    return m.buf


def walk(up_: bool) -> np.ndarray:
    """Three electric-piano notes through open fifths: up as someone arrives, down as they go."""
    m = Mix(0.8)
    notes = ["A4", "E5", "A5"] if up_ else ["A5", "E5", "A4"]
    for i, n in enumerate(notes):
        m.note(EP, n, i * 0.07, 0.1, gain=0.55, tail=0.4 if i == 2 else 0.2)
    return m.buf


def warp() -> np.ndarray:
    """Carried to another room: electric-piano fifths dipping down, then leaping up past the start."""
    m = Mix(0.9)
    for i, n in enumerate(["E5", "A4", "E5", "A5"]):
        m.note(EP, n, i * 0.07, 0.1, gain=0.55, tail=0.45 if i == 3 else 0.2)
    return m.buf


def showtime() -> np.ndarray:
    """Watch together starts: electric-piano fifths climbing an A major arpeggio into a soft choir chord."""
    m = Mix(1.2)
    for i, n in enumerate(["A4", "E5", "A5", "C#6"]):
        m.note(EP, n, i * 0.07, 0.1, gain=0.55, tail=0.5 if i == 3 else 0.2)
    for n in ("A3", "E4", "A4"):
        m.note(CHOIR, n, 0.2, 0.45, gain=0.2, tail=0.3)
    return m.buf


SOUNDS = {
    "message": message,
    "mention": mention,
    "ring": ring,
    "ringback": ringback,
    "callend": callend,
    "unmute": lambda: ep_note("E5"),
    "mute": lambda: ep_note("A4"),
    "camera-on": lambda: shutter(True),
    "camera-off": lambda: shutter(False),
    "join": lambda: walk(True),
    "leave": lambda: walk(False),
    "moved": warp,
    "watch-together-start": showtime,
}

if __name__ == "__main__":
    run(SOUNDS)
