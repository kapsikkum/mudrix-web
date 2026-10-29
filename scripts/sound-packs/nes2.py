"""Render Mudrix's "NES 2" notification pack through the ytpmv 2A03 model.

Needs the michael-rosen-says repo (app.ytpmv.nes). From that repo root:
    PYTHONPATH=. python <this file> <out_dir> [sound ...]

The same chip as the first NES pack, played the other way round. That one leaned on the sweep
unit, the echo trick and the triangle as bass; this one uses what it left alone: the DMC, the
channel games kept their sampled drums in (seven bits, moving two steps at a time, so every
sample comes out blunted), the triangle as a soft melody voice, the pulse width switched every
frame for a "wah", two pulses in thirds rather than one echoing the other, and a 6/8 shuffle.
"""

from __future__ import annotations

import importlib.util
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _common import SR, hz, run  # noqa: E402

from app.ytpmv import nes  # noqa: E402

_spec = importlib.util.spec_from_file_location("nespack", os.path.join(HERE, "nes.py"))
_nespack = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_nespack)
Channel, mixdown = _nespack.Channel, _nespack.mixdown


class DMC:
    """The sample channel: plays one 1-bit delta sample at a time and holds its level after."""

    def __init__(self, seconds: float):
        self.n = int(round(seconds * SR))
        self.level = np.full(self.n, np.nan)

    def play(self, at: float, sample: np.ndarray, setting: int = 15, wrap: bool = False):
        played = nes.dpcm(sample, setting, SR)
        idx = np.arange(int(round(at * SR)), int(round(at * SR)) + len(played))
        if wrap:
            idx %= self.n
        else:
            keep = idx < self.n
            idx, played = idx[keep], played[keep]
        self.level[idx] = played

    def render(self) -> np.ndarray:
        # Between samples the channel sits where the last one left it (64, its middle, to start).
        idx = np.where(~np.isnan(self.level), np.arange(self.n), 0)
        np.maximum.accumulate(idx, out=idx)
        out = np.nan_to_num(self.level[idx], nan=64.0)
        return np.asarray(nes.mix_tnd(dmc=out), dtype=np.float64)


def kick_sample() -> np.ndarray:
    t = np.arange(int(0.12 * SR)) / SR
    f = 50.0 + 110.0 * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)


def click_sample() -> np.ndarray:
    t = np.arange(int(0.012 * SR)) / SR
    rng = np.random.default_rng(7)
    return rng.uniform(-1, 1, len(t)) * np.exp(-t / 0.003)


def wah(ch: Channel, at: float, dur: float, note: str, vol: float, decay: float,
        cycle=(0, 1, 2, 1), frames_per_step: int = 2, wrap: bool = False) -> None:
    """A held note whose pulse width is rewritten every couple of frames: the NES "wah"."""
    step = frames_per_step / 60.0
    k = 0
    while k * step < dur:
        t0 = k * step
        v = vol * max(0.0, 1.0 - t0 / decay) if decay else vol
        ch.play(at + t0, min(step, dur - t0), note, vol=v, duty=cycle[k % len(cycle)], wrap=wrap)
        k += 1


# ── Sounds ────────────────────────────────────────────────────────────────────

def message() -> np.ndarray:
    """Two soft triangle notes falling a fifth, with a DMC tick on the first."""
    tri = Channel("triangle", 0.4)
    dmc = DMC(0.4)
    tri.play(0.0, 0.07, "E5")
    tri.play(0.08, 0.16, "A4")
    dmc.play(0.0, click_sample() * 0.6)
    return mixdown([tri, dmc], loop=False)


def mention() -> np.ndarray:
    """One pulse note with its width cycling for a "wah", the triangle an octave under, a DMC kick."""
    p = Channel("pulse", 0.6)
    tri = Channel("triangle", 0.6)
    dmc = DMC(0.6)
    wah(p, 0.0, 0.42, "A4", vol=0.75, decay=0.5)
    tri.play(0.0, 0.18, "A3")
    dmc.play(0.0, kick_sample())
    return mixdown([p, tri, dmc], loop=False)


def ring() -> np.ndarray:
    """Four bars of 6/8 shuffle in F, a town theme rather than an overworld; loops.

    Pulses in thirds, triangle bass on the dotted beats, the DMC for the kick and the noise for
    the snare and the swung hats.
    """
    e8 = 60.0 / 105.0 / 3.0            # 105 dotted-quarter beats a minute
    secs = 24 * e8
    p1, p2 = Channel("pulse", secs, duty=1), Channel("pulse", secs, duty=2)
    tri, noi, dmc = Channel("triangle", secs), Channel("noise", secs), DMC(secs)

    def steps(line, play):
        toks = line.split()
        for i, tok in enumerate(toks):
            if tok in (".", "-"):
                continue
            hold = 1
            while i + hold < len(toks) and toks[i + hold] == "-":
                hold += 1
            play(tok, i * e8, hold * e8)

    steps("A4 - C5 F5 - E5 D5 - F5 Bb4 - D5 C5 - E5 G5 F5 E5 F5 - - C5 - -",
          lambda n, at, d: p1.play(at, d * 0.92, n, vol=0.7, decay=d * 1.8,
                                   vibrato=0.2 if d > e8 * 1.5 else 0.0, wrap=True))
    steps("F4 - A4 C5 - C5 Bb4 - D5 F4 - Bb4 A4 - C5 E5 D5 C5 C5 - - A4 - -",
          lambda n, at, d: p2.play(at, d * 0.92, n, vol=0.3, decay=d * 1.8, wrap=True))
    steps("F2 - C3 F2 - C3 Bb2 - F3 Bb2 - F3 C3 - G3 C3 - G3 F2 - C3 F2 C3 E3",
          lambda n, at, d: tri.play(at, d * 0.9, n, wrap=True))
    for bar in range(4):
        base = bar * 6
        dmc.play((base + 0) * e8, kick_sample() * 0.6, wrap=True)
        noi.play((base + 3) * e8, 0.12, 0.0, vol=0.55, decay=0.12, setting=7, wrap=True)
        for i in (1, 2, 4, 5):
            noi.play((base + i) * e8, 0.025, 0.0, vol=0.25 if i in (2, 5) else 0.18,
                     decay=0.025, setting=0, wrap=True)
    return mixdown([p1, p2, tri, noi, dmc], loop=True)


def ringback() -> np.ndarray:
    """A "wah" phone: one note phasing through the pulse widths every frame, twice, then a gap."""
    secs = 3.0
    p = Channel("pulse", secs)
    for at in (0.0, 0.62):
        wah(p, at, 0.45, "E5", vol=0.5, decay=0.0, cycle=(0, 1, 2, 3, 2, 1), frames_per_step=1,
            wrap=True)
    return mixdown([p], loop=True)


def callend() -> np.ndarray:
    """The triangle gliding two octaves down in frame steps, a noise wash, a last DMC kick."""
    tri = Channel("triangle", 0.8)
    noi = Channel("noise", 0.8)
    dmc = DMC(0.8)
    tri.play(0.0, 0.42, lambda t: hz("C5") * 2.0 ** (-24.0 * np.minimum(t, 0.4) / 0.4 / 12.0))
    noi.play(0.0, 0.4, 0.0, vol=0.25, decay=0.4, setting=9)
    dmc.play(0.42, kick_sample())
    return mixdown([tri, noi, dmc], loop=False)


def tri_blip(up: bool) -> np.ndarray:
    tri = Channel("triangle", 0.25)
    if up:
        tri.play(0.0, 0.05, "G4")
        tri.play(0.055, 0.08, "C5")
    else:
        tri.play(0.0, 0.05, "C5")
        tri.play(0.055, 0.08, "G4")
    return mixdown([tri], loop=False)


def shutter(up: bool) -> np.ndarray:
    dmc = DMC(0.25)
    tri = Channel("triangle", 0.25)
    dmc.play(0.0, click_sample())
    dmc.play(0.035, click_sample() * 0.6)
    tri.play(0.05, 0.07, "E5" if up else "A4")
    return mixdown([dmc, tri], loop=False)


def walk(up: bool) -> np.ndarray:
    """A door click off the DMC, then the triangle climbing (or dropping) a C major triad."""
    dmc = DMC(0.4)
    tri = Channel("triangle", 0.4)
    notes = ["C5", "E5", "G5"] if up else ["G5", "E5", "C5"]
    dmc.play(0.0 if up else 0.17, click_sample() * 0.6)
    for i, n in enumerate(notes):
        tri.play(0.03 + i * 0.06, 0.06 if i < 2 else 0.12, n)
    return mixdown([dmc, tri], loop=False)


def warp() -> np.ndarray:
    """Carried to another room: a door click off the DMC, the triangle dipping and leaping up, and
    the door clicking again on the far side."""
    dmc = DMC(0.5)
    tri = Channel("triangle", 0.5)
    dmc.play(0.0, click_sample() * 0.6)
    dmc.play(0.15, click_sample() * 0.6)
    for i, n in enumerate(["G5", "C5", "G5", "C6"]):
        tri.play(0.03 + i * 0.055, 0.055 if i < 3 else 0.14, n)
    return mixdown([dmc, tri], loop=False)


def showtime() -> np.ndarray:
    """Watch together starts: a click off the DMC like a play button, then the triangle running up a
    C major arpeggio and holding the top."""
    dmc = DMC(0.9)
    tri = Channel("triangle", 0.9)
    dmc.play(0.0, click_sample() * 0.6)
    notes = ["C5", "E5", "G5", "C6", "E6"]
    for i, n in enumerate(notes):
        tri.play(0.04 + i * 0.055, 0.055 if i < 4 else 0.3, n)
    return mixdown([dmc, tri], loop=False)


SOUNDS = {
    "message": message,
    "mention": mention,
    "ring": ring,
    "ringback": ringback,
    "callend": callend,
    "unmute": lambda: tri_blip(True),
    "mute": lambda: tri_blip(False),
    "camera-on": lambda: shutter(True),
    "camera-off": lambda: shutter(False),
    "join": lambda: walk(True),
    "leave": lambda: walk(False),
    "moved": warp,
    "watch-together-start": showtime,
}

if __name__ == "__main__":
    run(SOUNDS)
