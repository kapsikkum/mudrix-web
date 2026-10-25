"""Render Mudrix's "NES" notification pack through the ytpmv 2A03 model.

Needs the 2A03 model from the michael-rosen-says repo (app.ytpmv.nes). From that repo root:
    PYTHONPATH=. python <this file> <out_dir> [sound ...]
Writes one WAV per sound into out_dir; encode with ffmpeg -c:a libmp3lame -b:a 160k.

Written like a tracker, not a mixer: the chip has two pulses, a triangle and a noise channel,
each of them plays one thing at a time, and a new note cuts off the last. Everything else
here is what NES composers did inside that -- the sweep unit's stepped slides, chords
faked by arpeggiating every frame, the second pulse echoing the first a few frames late,
and the triangle dropping its pitch for a beat to stand in for a kick drum.
"""

from __future__ import annotations

import sys
import wave
from collections.abc import Callable
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

from app.ytpmv import nes

SR = nes.SR
OS = nes.OVERSAMPLE
CPU = nes.CPU


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
    return 440.0 * 2.0 ** ((n + 12 * (int(rest) + 1) - 69) / 12.0)


def _clock(t: np.ndarray, rate: float) -> np.ndarray:
    """*t* held to the last tick of a *rate* Hz clock, as the frame counter does it."""
    return np.floor(t * rate) / rate


class Channel:
    """One of the chip's channels over the whole sound: what it plays, sample by sample."""

    def __init__(self, kind: str, seconds: float, duty: int = 2, setting: int = 8, mode: int = 0):
        self.kind = kind
        self.n = int(round(seconds * SR))
        self.f = np.full(self.n, 440.0)
        self.v = np.zeros(self.n)          # 0-1 volume; for the triangle, 1 means on
        self.duty = np.full(self.n, duty, dtype=np.int64)
        self.setting = np.full(self.n, setting, dtype=np.int64)   # noise: its rate, note by note
        self.mode = mode

    def play(self, at: float, dur: float, pitch: str | float | Callable[[np.ndarray], np.ndarray],
             vol: float = 1.0, decay: float = 0.0, sweep: float = 0.0, sweep_time: float = 0.05,
             vibrato: float = 0.0, duty: int | None = None, setting: int | None = None,
             wrap: bool = False) -> None:
        """A note. Cuts off whatever the channel was doing, like the real thing.

        *sweep* is semitones the note starts away from its pitch and slides in from (or, with a
        callable *pitch*, ignored); the slide moves in the sweep unit's 120 Hz steps. *decay* is
        the volume envelope's fall to silence in seconds, in its 240 Hz steps.
        """
        k = int(round(dur * SR))
        t = np.arange(k) / SR
        if callable(pitch):
            f = pitch(_clock(t, 120.0))
        else:
            base = hz(pitch) if isinstance(pitch, str) else float(pitch)
            semis = np.zeros(k)
            if sweep:
                semis = sweep * np.maximum(0.0, 1.0 - _clock(t, 120.0) / sweep_time)
            if vibrato:
                # Delayed vibrato, a frame-stepped wobble that only comes in once the note has held.
                tf = _clock(t, 60.0)
                semis = semis + vibrato * np.sin(2 * np.pi * 6.0 * tf) * np.clip((tf - 0.12) / 0.1, 0, 1)
            f = base * 2.0 ** (semis / 12.0)
        te = _clock(t, 240.0)
        v = np.full(k, vol) if decay <= 0 else vol * np.maximum(0.0, 1.0 - te / decay)
        idx = np.arange(int(round(at * SR)), int(round(at * SR)) + k)
        if wrap:
            idx %= self.n
        else:
            keep = idx < self.n
            idx, f, v = idx[keep], f[keep], v[keep]
        self.f[idx] = f
        self.v[idx] = v
        if duty is not None:
            self.duty[idx] = duty
        if setting is not None:
            self.setting[idx] = setting

    def render(self) -> np.ndarray:
        isr = SR * OS
        f = np.repeat(self.f, OS)
        v = np.repeat(self.v, OS)
        if self.kind == "pulse":
            div = np.clip(np.round(CPU / (16.0 * np.maximum(f, 1e-6)) - 1.0), 8.0, 2047.0)
            step = np.floor(np.cumsum(CPU / (16.0 * (div + 1.0))) / isr * 8.0).astype(np.int64) % 8
            duty = np.repeat(self.duty, OS)
            width = np.choose(duty & 3, (1, 2, 4, 2))
            on = step < width
            on = np.where((duty & 3) == 3, ~on, on)
            # Four-bit volume: sixteen steps, nothing between.
            out = nes.mix_pulse(on * np.round(v * 15.0))
        elif self.kind == "triangle":
            # No volume control: it is on or it is off. Off, its sequencer stops where it is
            # and the output holds that step, which is why it does not click when it stops.
            div = np.clip(np.round(CPU / (32.0 * np.maximum(f, 1e-6)) - 1.0), 0.0, 2047.0)
            gate = (v > 0).astype(np.float64)
            step = np.floor(np.cumsum(CPU / (32.0 * (div + 1.0)) * gate) / isr * 32.0).astype(np.int64) % 32
            out = nes.mix_tnd(tri=np.where(step < 16, 15 - step, step - 16).astype(np.float64))
        else:
            bits = nes.noise_bits(self.mode)
            rate = CPU / np.asarray(nes.NOISE_PERIODS, dtype=np.float64)[np.repeat(self.setting, OS)]
            sig = bits[(np.cumsum(rate) / isr).astype(np.int64) % len(bits)]
            out = nes.mix_tnd(noi=sig * np.round(v * 15.0))
        return nes._down(np.asarray(out, dtype=np.float64), SR).astype(np.float64)


def mixdown(chans: list[Channel], loop: bool) -> np.ndarray:
    y = sum(c.render() for c in chans)
    # The console's own output stage: a high-pass (the Famicom's, at 37 Hz) and a low-pass at
    # 14 kHz. A loop goes through twice so the filters are settled when its seam comes round.
    hp = butter(1, 37.0, "highpass", fs=SR, output="sos")
    lp = butter(1, 14000.0, "lowpass", fs=SR, output="sos")
    if loop:
        twice = sosfilt(lp, sosfilt(hp, np.concatenate([y, y])))
        return twice[len(y):]
    # A one-shot is settled on its resting level first. The triangle idles at whatever step it
    # stopped on, which is a constant the high-pass removes; starting the filter from zero instead
    # turns that constant into a click on the very first sample.
    pad = int(0.25 * SR)
    settled = sosfilt(lp, sosfilt(hp, np.concatenate([np.full(pad, y[0]), y])))
    return settled[pad:]


# ── Sounds ────────────────────────────────────────────────────────────────────

def message() -> np.ndarray:
    """A menu "select": one note swept up a fifth onto E5, the second pulse echoing it."""
    p1 = Channel("pulse", 0.5, duty=1)
    p2 = Channel("pulse", 0.5, duty=1)
    p1.play(0.0, 0.3, "E5", vol=0.9, decay=0.3, sweep=-7, sweep_time=0.045)
    p2.play(0.09, 0.3, "E5", vol=0.35, decay=0.3, sweep=-7, sweep_time=0.045)
    return mixdown([p1, p2], loop=False)


def mention() -> np.ndarray:
    """A chord the NES way, arpeggiated a note a frame, then a bright note to land on."""
    p1 = Channel("pulse", 0.75, duty=2)
    p2 = Channel("pulse", 0.75, duty=1)
    tri = Channel("triangle", 0.75)
    noi = Channel("noise", 0.75, setting=3, mode=1)
    chord = np.array([hz("A4"), hz("C#5"), hz("E5")])
    p1.play(0.0, 0.22, lambda t: chord[(np.round(t * 60.0).astype(int)) % 3], vol=0.7, decay=0.35)
    p2.play(0.2, 0.45, "A5", vol=0.75, decay=0.45, sweep=-2, sweep_time=0.03, vibrato=0.25)
    tri.play(0.0, 0.12, "A2")
    noi.play(0.0, 0.04, 8000.0, vol=0.5, decay=0.04)
    return mixdown([p1, p2, tri, noi], loop=False)


def ring() -> np.ndarray:
    """Two bars of overworld at 150 bpm: octave triangle bass, an echoed lead, noise kit; loops."""
    s16 = 60.0 / 150.0 / 4.0
    secs = 32 * s16
    lead = Channel("pulse", secs, duty=1)
    echo = Channel("pulse", secs, duty=1)
    tri = Channel("triangle", secs)
    noi = Channel("noise", secs, setting=1)

    # i - VII - VI - V in A minor, an eighth-note octave bounce on the triangle.
    roots = ("A2", "G2", "F2", "E2")
    for beat in range(16):
        root = roots[beat // 4]
        up = root[:-1] + str(int(root[-1]) + 1)
        tri.play(beat * 2 * s16, s16 * 0.9, root, wrap=True)
        tri.play((beat * 2 + 1) * s16, s16 * 0.9, up, wrap=True)
    # The triangle kick: on beats one and three, a fast drop from up high that cuts the bass.
    for beat in (0, 2, 4, 6):
        tri.play(beat * 4 * s16, 0.035, lambda t: 260.0 * 2.0 ** (-t / 0.012) + 45.0, wrap=True)

    tune = ("A4 . C5 . E5 . D5 C5 B4 . G4 . B4 . D5 . "
            "C5 . A4 . F4 . A4 C5 B4 - - G#4 - - E4 .").split()
    for i, tok in enumerate(tune):
        if tok in (".", "-"):
            continue
        hold = 1
        while i + hold < len(tune) and tune[i + hold] == "-":
            hold += 1
        dur = hold * s16 * 0.95
        lead.play(i * s16, dur, tok, vol=0.75, decay=dur * 1.6, vibrato=0.2 if hold > 1 else 0.0,
                  wrap=True)
        # The echo: the same line three frames behind, on the other pulse, much quieter.
        echo.play(i * s16 + 3 / 60.0, dur, tok, vol=0.28, decay=dur * 1.6, wrap=True)

    # One noise channel for the whole kit, as on the machine: closed hats on the eighths at a
    # high rate, and on two and four the rate dropped for a longer, darker snare.
    for i in range(0, 32, 2):
        if i % 8 == 4:
            noi.play(i * s16, 0.13, 0.0, vol=0.6, decay=0.13, setting=6, wrap=True)
        else:
            noi.play(i * s16, 0.03, 0.0, vol=0.3 if i % 4 else 0.4, decay=0.03, setting=1,
                     wrap=True)
    return mixdown([lead, echo, tri, noi], loop=True)


def ringback() -> np.ndarray:
    """A calm "calling": two soft hollow notes with an echo, twice, then a long gap; loops."""
    secs = 2.4
    p1 = Channel("pulse", secs, duty=2)
    p2 = Channel("pulse", secs, duty=2)
    for at in (0.0, 0.7):
        p1.play(at, 0.16, "E5", vol=0.55, decay=0.3, wrap=True)
        p1.play(at + 0.18, 0.36, "A4", vol=0.55, decay=0.5, vibrato=0.15, wrap=True)
        p2.play(at + 0.1, 0.16, "E5", vol=0.2, decay=0.3, wrap=True)
        p2.play(at + 0.28, 0.36, "A4", vol=0.2, decay=0.5, wrap=True)
    return mixdown([p1, p2], loop=True)


def callend() -> np.ndarray:
    """Power down: the sweep unit dragging a note two octaves down, the triangle falling under it."""
    p1 = Channel("pulse", 0.8, duty=2)
    tri = Channel("triangle", 0.8)
    noi = Channel("noise", 0.8, setting=10)
    p1.play(0.0, 0.5, lambda t: hz("A5") * 2.0 ** (-24.0 * np.minimum(t, 0.45) / 0.45 / 12.0),
            vol=0.8, decay=0.55)
    for i, n in enumerate(("A3", "E3", "A2")):
        tri.play(0.06 + i * 0.1, 0.09, n)
    noi.play(0.32, 0.3, 0.0, vol=0.35, decay=0.3)
    return mixdown([p1, tri, noi], loop=False)


def sweep_blip(up: bool) -> np.ndarray:
    p = Channel("pulse", 0.25, duty=3)
    p.play(0.0, 0.12, "E5" if up else "A4", vol=0.8, decay=0.16, sweep=-7 if up else 7,
           sweep_time=0.06)
    return mixdown([p], loop=False)


def shutter(up: bool) -> np.ndarray:
    """A camera: a click off the short shift register, and a note going the right way."""
    p = Channel("pulse", 0.3, duty=0)
    noi = Channel("noise", 0.3, setting=2, mode=1)
    noi.play(0.0, 0.03, 0.0, vol=0.6, decay=0.03)
    noi.play(0.045, 0.025, 0.0, vol=0.4, decay=0.025)
    p.play(0.03, 0.14, "C#5" if up else "F#4", vol=0.6, decay=0.16, sweep=-5 if up else 5,
           sweep_time=0.05)
    return mixdown([p, noi], loop=False)


def walk(up: bool) -> np.ndarray:
    """Someone walking in (a rising A major arpeggio) or out (the same falling), on the pulse channel."""
    p = Channel("pulse", 0.4, duty=2)
    notes = ["A4", "C#5", "E5"] if up else ["E5", "C#5", "A4"]
    for i, n in enumerate(notes):
        last = i == len(notes) - 1
        p.play(i * 0.065, 0.2 if last else 0.06, n, vol=0.7, decay=0.2 if last else 0.07)
    return mixdown([p], loop=False)


SOUNDS = {
    "message": message,
    "mention": mention,
    "ring": ring,
    "ringback": ringback,
    "callend": callend,
    "unmute": lambda: sweep_blip(True),
    "mute": lambda: sweep_blip(False),
    "camera-on": lambda: shutter(True),
    "camera-off": lambda: shutter(False),
    "join": lambda: walk(True),
    "leave": lambda: walk(False),
}

PEAK_DB = {"message": -4.0, "mention": -3.0, "ring": -2.0, "ringback": -5.0, "callend": -3.0}


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
    target = 10 ** (PEAK_DB.get(name, -5.0) / 20.0)
    y = y / (np.max(np.abs(y)) or 1.0) * target
    if not loop:
        thresh = 10 ** (-60 / 20) * target
        nz = np.nonzero(np.abs(y) > thresh)[0]
        y = y[: (nz[-1] + 1 if len(nz) else len(y))]
        edge = min(len(y), int(0.005 * SR))
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
