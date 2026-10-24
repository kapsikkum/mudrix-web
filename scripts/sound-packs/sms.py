"""Render Mudrix's "SMS" notification pack through the ytpmv SN76489 (Master System) model.

Needs the michael-rosen-says repo (app.ytpmv.sms). From that repo root:
    PYTHONPATH=. python <this file> <out_dir> [sound ...]

A tracker for a chip with almost nothing to it: three plain squares, one noise channel, and
volume in two-decibel steps. What Master System music did inside that, and what this does:
two squares a divider step or two apart for a chorus that beats, real three-note chords
(the NES had to fake them), envelopes written by software a frame at a time so every fade
moves in audible steps, and the noise channel in its periodic mode clocked off tone 3 -- a
buzz an octave and more below anything the tone channels can reach, which is how this chip
got a bass at all.
"""

from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import SR, hz, run  # noqa: E402

from app.ytpmv import sms  # noqa: E402

OS = sms.OVERSAMPLE
CLOCK = sms.CLOCK
ATT = np.array([sms.attenuation(s) for s in range(16)])


def _frames(t: np.ndarray) -> np.ndarray:
    """Software envelopes move once a video frame."""
    return np.floor(t * 60.0) / 60.0


def _att_step(vol: np.ndarray) -> np.ndarray:
    """0-1 volume to the nearest of the attenuator's sixteen steps (15 is silence)."""
    db = -20.0 * np.log10(np.maximum(vol, 1e-6))
    return np.where(vol <= 1e-4, 15, np.clip(np.round(db / 2.0), 0, 15)).astype(np.int64)


class Chan:
    """One channel over the whole sound. Tone channels play pitches; the noise channel plays
    white or periodic noise at one of three fixed rates, or (rate 3) at tone 3's pitch."""

    def __init__(self, kind: str, seconds: float, periodic: bool = False):
        self.kind = kind
        self.n = int(round(seconds * SR))
        self.f = np.full(self.n, 440.0)
        self.v = np.zeros(self.n)
        self.setting = np.zeros(self.n, dtype=np.int64)
        self.periodic = periodic

    def play(self, at, dur, pitch, vol=1.0, decay=0.0, detune=0.0, vibrato=0.0, setting=0,
             wrap=False):
        k = int(round(dur * SR))
        t = np.arange(k) / SR
        tf = _frames(t)
        f = np.full(k, (hz(pitch) if isinstance(pitch, str) else float(pitch)) * 2 ** (detune / 1200))
        if vibrato:
            f = f * 2 ** (vibrato * np.sin(2 * np.pi * 5.5 * tf) * np.clip((tf - 0.1) / 0.1, 0, 1) / 12)
        v = np.full(k, vol) if decay <= 0 else vol * np.maximum(0.0, 1.0 - tf / decay)
        idx = np.arange(int(round(at * SR)), int(round(at * SR)) + k)
        if wrap:
            idx %= self.n
        else:
            keep = idx < self.n
            idx, f, v = idx[keep], f[keep], v[keep]
        self.f[idx], self.v[idx], self.setting[idx] = f, v, setting

    def render(self, tone3: np.ndarray | None = None) -> np.ndarray:
        isr = SR * OS
        att = ATT[np.repeat(_att_step(self.v), OS)]
        if self.kind == "tone":
            f = np.repeat(self.f, OS)
            div = np.clip(np.round(CLOCK / (32.0 * np.maximum(f, 1e-6))), 1, 1023)
            phase = np.cumsum(CLOCK / (32.0 * div)) / isr
            sig = np.where((phase % 1.0) < 0.5, 1.0, -1.0)
        else:
            bits = sms.lfsr_bits(self.periodic).astype(np.float64)
            setting = np.repeat(self.setting, OS)
            fixed = CLOCK / 16.0 / (2.0 * np.array(sms.NOISE_RELOADS, dtype=np.float64))
            rate = fixed[np.minimum(setting, 2)]
            if tone3 is not None:
                # Rate 3: the register shifts each time tone 3's counter runs out.
                t3 = np.repeat(tone3, OS)
                div = np.clip(np.round(CLOCK / (32.0 * np.maximum(t3, 1e-6))), 1, 1023)
                rate = np.where(setting >= 3, CLOCK / (32.0 * div), rate)
            idx = (np.cumsum(rate) / isr).astype(np.int64) % len(bits)
            sig = bits[idx] * 2.0 - 1.0
        return sms._down((sig * att).astype(np.float32), SR).astype(np.float64)


def mix(tones: list[Chan], noise: Chan | None = None, tone3: Chan | None = None) -> np.ndarray:
    y = sum(c.render() for c in tones)
    if noise is not None:
        y = y + noise.render(tone3.f if tone3 is not None else None)
    return y


# ── Sounds ────────────────────────────────────────────────────────────────────

def message() -> np.ndarray:
    """"Da-ding": a grace note into C5, on two squares a divider step apart so it shimmers."""
    a, b = Chan("tone", 0.6), Chan("tone", 0.6)
    for ch, cents, vol in ((a, 0.0, 0.8), (b, 9.0, 0.6)):
        ch.play(0.0, 0.045, "G4", vol=vol)
        ch.play(0.05, 0.5, "C5", vol=vol, decay=0.45, detune=cents)
    return mix([a, b])


def mention() -> np.ndarray:
    """A real three-note chord, which this chip can do and the NES cannot, over a bass that
    comes from the noise channel clocked off the chord's top note."""
    t1, t2, t3 = Chan("tone", 0.8), Chan("tone", 0.8), Chan("tone", 0.8)
    noi = Chan("noise", 0.8, periodic=True)
    t1.play(0.0, 0.04, "G4", vol=0.7)
    t1.play(0.05, 0.6, "E5", vol=0.7, decay=0.55)
    t2.play(0.05, 0.6, "G5", vol=0.6, decay=0.55)
    t3.play(0.05, 0.6, "C6", vol=0.55, decay=0.55)
    # Periodic noise repeats every 16 shifts: clocked off tone 3 at C6, it sounds C2.
    noi.play(0.05, 0.3, 0.0, vol=0.7, decay=0.3, setting=3)
    return mix([t1, t2, t3], noi, t3)


def ring() -> np.ndarray:
    """Two bars of Master System adventure at 132 bpm, A major; loops.

    Tone 3 takes the bass (it cannot go under 109 Hz, so the key sits on A), tone 1 the lead
    in stepped plucks, tone 2 a running counter-line of broken chords, and the one noise
    channel the kit.
    """
    s16 = 60.0 / 132.0 / 4.0
    secs = 32 * s16
    lead, counter, bass = Chan("tone", secs), Chan("tone", secs), Chan("tone", secs)
    noi = Chan("noise", secs)

    def steps(ch, line, bar, **kw):
        toks = line.split()
        for i, tok in enumerate(toks):
            if tok in (".", "-"):
                continue
            hold = 1
            while i + hold < len(toks) and toks[i + hold] == "-":
                hold += 1
            ch.play((bar * 16 + i) * s16, hold * s16 * 0.95, tok, wrap=True,
                    **{k: (v(hold) if callable(v) else v) for k, v in kw.items()})

    steps(bass, "A2 . . A2 . . E3 . A2 . . A2 C#3 . E3 .", 0, vol=0.75, decay=lambda h: h * s16 * 2)
    steps(bass, "D3 . . D3 . . A2 . E3 . . E3 B2 . E3 .", 1, vol=0.75, decay=lambda h: h * s16 * 2)
    steps(lead, "E5 . C#5 . A4 . C#5 E5 - . F#5 E5 . C#5 - .", 0, vol=0.7,
          decay=lambda h: h * s16 * 2.2, vibrato=lambda h: 0.18 if h > 1 else 0.0)
    steps(lead, "D5 . F#5 . A5 - . F#5 E5 . D5 . B4 - - .", 1, vol=0.7,
          decay=lambda h: h * s16 * 2.2, vibrato=lambda h: 0.18 if h > 1 else 0.0)
    arps = (["A4", "C#5", "E5", "C#5"] * 4) + (["F#4", "A4", "D5", "A4"] * 2) + (["G#4", "B4", "E5", "B4"] * 2)
    for i, n in enumerate(arps):
        counter.play(i * s16, s16 * 0.7, n, vol=0.32, decay=s16 * 1.2, wrap=True)
    for i in range(0, 32, 2):
        if i % 8 == 4:
            noi.play(i * s16, 0.12, 0.0, vol=0.6, decay=0.12, setting=2, wrap=True)
        else:
            noi.play(i * s16, 0.03, 0.0, vol=0.4 if i % 4 == 0 else 0.25, decay=0.03,
                     setting=0, wrap=True)
    return mix([lead, counter, bass], noi)


def ringback() -> np.ndarray:
    """An electronic phone: two squares about 10 Hz apart beat into a trill on their own,
    with a soft fifth above; two bursts and a gap, 3 s; loops."""
    secs = 3.0
    a, b, c = Chan("tone", secs), Chan("tone", secs), Chan("tone", secs)
    for at in (0.0, 0.6):
        a.play(at, 0.42, "A4", vol=0.6, wrap=True)
        b.play(at, 0.42, hz("A4") + 10.0, vol=0.6, wrap=True)
        c.play(at, 0.42, "E5", vol=0.18, wrap=True)
    return mix([a, b, c])


def callend() -> np.ndarray:
    """A chromatic run tumbling down, echoed two frames behind, landing on a noise-bass thud."""
    secs = 0.9
    a, b, t3 = Chan("tone", secs), Chan("tone", secs), Chan("tone", secs)
    noi = Chan("noise", secs, periodic=True)
    for i in range(10):
        n = hz("E6") * 2 ** (-i / 12)
        a.play(i * 0.026, 0.03, n, vol=0.65)
        b.play(i * 0.026 + 2 / 60, 0.03, n, vol=0.25)
    # Tone 3 stays silent; it is only there to clock the noise: A5 / 16 is an A1 rumble.
    t3.play(0.27, 0.28, "A5", vol=0.0)
    noi.play(0.27, 0.28, 0.0, vol=0.8, decay=0.25, setting=3)
    return mix([a, b], noi, t3)


def octave_blip(up: bool) -> np.ndarray:
    a = Chan("tone", 0.3)
    lo, hi = "A4", "A5"
    a.play(0.0, 1 / 60, lo if up else hi, vol=0.7)
    a.play(1 / 60, 0.22, hi if up else lo, vol=0.7, decay=0.2)
    return mix([a])


def shutter(up: bool) -> np.ndarray:
    a = Chan("tone", 0.3)
    noi = Chan("noise", 0.3)
    noi.play(0.0, 0.035, 0.0, vol=0.7, decay=0.035, setting=0)
    a.play(0.03, 0.15, "E5" if up else "A4", vol=0.55, decay=0.15)
    return mix([a], noi)


SOUNDS = {
    "message": message,
    "mention": mention,
    "ring": ring,
    "ringback": ringback,
    "callend": callend,
    "unmute": lambda: octave_blip(True),
    "mute": lambda: octave_blip(False),
    "camera-on": lambda: shutter(True),
    "camera-off": lambda: shutter(False),
}

if __name__ == "__main__":
    run(SOUNDS)
