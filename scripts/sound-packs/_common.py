"""Shared by the sound-pack generators: note names, levelling, loop handling, WAV output, CLI."""

from __future__ import annotations

import sys
import wave
from collections.abc import Callable
from pathlib import Path

import numpy as np

SR = 44100

# One-shots are levelled by how loud they sound, not by their peak: the loudest 100 ms of each,
# in dB RMS, set to sit with the other packs (Element, Cinny, FluffyChat sit around -14 to -18).
LOUDNESS_DB = {"message": -17.0, "mention": -16.0, "callend": -17.0}
VOICE_LOUDNESS_DB = -18.0
LOOP_LOUDNESS_DB = {"ring": -12.0, "ringback": -15.0}
PEAK_CEILING_DB = -3.0
LOOPS = ("ring", "ringback")


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


def up(note: str, octaves: int = 1) -> str:
    return note[:-1] + str(int(note[-1]) + octaves)


def loudest_100ms_db(y: np.ndarray) -> float:
    w = int(0.1 * SR)
    if len(y) < w:
        return 10 * np.log10(np.mean(y ** 2) + 1e-12)
    return 10 * np.log10(np.convolve(y ** 2, np.ones(w) / w, "valid").max() + 1e-12)


def finish(y: np.ndarray, name: str) -> np.ndarray:
    y = np.asarray(y, dtype=np.float64)
    if name in LOOPS:
        # Levelled the same way, but whole: a loop must not be trimmed or faded.
        y = y * 10 ** ((LOOP_LOUDNESS_DB[name] - loudest_100ms_db(y)) / 20.0)
        ceiling = 10 ** (PEAK_CEILING_DB / 20.0)
        peak = np.max(np.abs(y))
        return y * (ceiling / peak) if peak > ceiling else y
    # Trim the trailing near-silence, then a short fade so nothing ends on a step.
    peak = np.max(np.abs(y)) or 1.0
    nz = np.nonzero(np.abs(y) > peak * 10 ** (-60 / 20))[0]
    y = y[: (nz[-1] + 1 if len(nz) else len(y))].copy()
    edge = min(len(y), int(0.005 * SR))
    y[-edge:] *= np.linspace(1.0, 0.0, edge)
    y = y * 10 ** ((LOUDNESS_DB.get(name, VOICE_LOUDNESS_DB) - loudest_100ms_db(y)) / 20.0)
    ceiling = 10 ** (PEAK_CEILING_DB / 20.0)
    peak = np.max(np.abs(y))
    return y * (ceiling / peak) if peak > ceiling else y


def write_wav(path: Path, y: np.ndarray) -> None:
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def run(sounds: dict[str, Callable[[], np.ndarray]]) -> None:
    """CLI: <out_dir> [sound ...] -> one WAV per sound."""
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    for name, fn in sounds.items():
        if only and name not in only:
            continue
        y = finish(fn(), name)
        write_wav(out / f"{name}.wav", y)
        print(f"{name:11s} {len(y) / SR:5.2f}s  peak {20 * np.log10(np.max(np.abs(y)) + 1e-12):6.1f} dBFS  "
              f"loud {loudest_100ms_db(y):6.1f} dB")
