"""Call-sound variants (ring, ringback, callend) for the Mudrix pack candidates.

Needs the michael-rosen-says repo (app.ytpmv). From that repo root:
    PYTHONPATH=. python <this file> <out_dir>

Each pattern is written once, as semitones above the key note, and played by each pack's voice:
Bloop (NES triangle with a pulse echo), Glass (Mega Drive FM blips and bells), Warm (two
Master System squares a few cents apart). Rings and ringbacks loop, so their notes wrap round the
end and the seam is checked for a click.
"""

from __future__ import annotations

import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _common import SR, finish, hz, write_wav  # noqa: E402
from mudrix import BELL, BLIP, Chan, Channel, Mix, mixdown, smix, stack  # noqa: E402

# (start, semitones above the key note, length) per note
Pattern = list[tuple[float, int, float]]


def arp(steps: list[int], step: float, last: float) -> Pattern:
    return [(i * step, s, last if i == len(steps) - 1 else step) for i, s in enumerate(steps)]


RINGS: dict[str, tuple[float, Pattern]] = {
    # an arpeggio up and back, twice over, then a rest
    "ring-a-arpeggio": (2.4, arp([0, 4, 7, 12, 7, 4, 7, 12], 0.11, 0.3)),
    # "ding-dong" twice: a high note and the fifth under it
    "ring-b-doorbell": (2.0, [(0.0, 12, 0.15), (0.17, 7, 0.4), (0.9, 12, 0.15), (1.07, 7, 0.4)]),
    # a syncopated little tune with a hole in the middle
    "ring-c-bounce": (2.4, [(0.0, 0, 0.1), (0.2, 4, 0.1), (0.3, 7, 0.1), (0.55, 7, 0.1), (0.65, 4, 0.1),
                            (1.0, 0, 0.1), (1.2, 4, 0.1), (1.3, 7, 0.1), (1.5, 12, 0.25)]),
}
RINGBACKS: dict[str, tuple[float, Pattern]] = {
    "ringback-a-pair": (3.2, [(0.0, 7, 0.2), (0.2, 0, 0.4), (0.9, 7, 0.2), (1.1, 0, 0.4)]),
    "ringback-b-single": (3.2, [(0.0, 7, 0.5), (1.6, 7, 0.5)]),
}
CALLENDS: dict[str, tuple[float, Pattern]] = {
    "callend-a-fall": (0.9, arp([12, 7, 4, 0, -5], 0.075, 0.3)),
    "callend-b-triple": (0.7, arp([12, 7, 0], 0.09, 0.3)),
}


def pitch(root: str, semis: int) -> float:
    return hz(root) * 2.0 ** (semis / 12.0)


# ── voices ───────────────────────────────────────────────────────────────────────────────────
def bloop(secs: float, pat: Pattern, loop: bool, soft: float = 1.0) -> np.ndarray:
    tri = Channel("triangle", secs)
    echo = Channel("pulse", secs, duty=2)
    for at, semis, dur in pat:
        f = pitch("E5", semis)
        tri.play(at, dur, f, wrap=loop)
        echo.play(at + 0.13, dur, f, vol=0.16, decay=0.2, wrap=loop)
    return mixdown([tri], loop=loop) * soft + mixdown([echo], loop=loop)


def glass(secs: float, pat: Pattern, loop: bool, soft: float = 1.0) -> np.ndarray:
    m = Mix(secs)
    for at, semis, dur in pat:
        f = pitch("E5", semis)
        m.note(BLIP, f, at, 0.06, gain=0.8 * soft, tail=0.35, wrap=loop)
        if dur >= 0.25:
            m.note(BELL, f / 2, at, 0.3, gain=0.22 * soft, tail=0.5, wrap=loop)
    return m.buf


def warm(secs: float, pat: Pattern, loop: bool, soft: float = 1.0) -> np.ndarray:
    a, b = Chan("tone", secs), Chan("tone", secs)
    for at, semis, dur in pat:
        f = pitch("D5", semis)
        a.play(at, dur, f, vol=0.6 * soft, decay=0.3, detune=9, vibrato=0.2, wrap=loop)
        b.play(at, dur, f, vol=0.36 * soft, decay=0.3, detune=-9, vibrato=0.2, wrap=loop)
    return smix([a, b])


VOICES = {"2-bloop": bloop, "3-glass": glass, "7-warm": warm}


def seam_click(y: np.ndarray) -> float:
    """How much louder the step across the loop point is than the steps around it (1 = none)."""
    two = np.concatenate([y, y])
    d = np.abs(np.diff(two))
    seam = d[len(y) - 4: len(y) + 3].max()
    typical = np.percentile(d, 99)
    return float(seam / (typical + 1e-12))


if __name__ == "__main__":
    out = sys.argv[1]
    for pack, voice in VOICES.items():
        os.makedirs(os.path.join(out, pack), exist_ok=True)
        for group in (RINGS, RINGBACKS, CALLENDS):
            for name, (secs, pat) in group.items():
                kind = name.split("-")[0]
                loop = kind in ("ring", "ringback")
                soft = 0.8 if kind == "ringback" else 1.0
                y = finish(voice(secs, pat, loop, soft), kind)
                write_wav(__import__("pathlib").Path(out) / pack / f"{name}.wav", y)
                note = f"  seam x{seam_click(y):.1f}" if loop else ""
                print(f"{pack:8s} {name:20s} {len(y) / SR:4.2f}s{note}")
