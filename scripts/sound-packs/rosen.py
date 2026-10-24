"""Build Mudrix's "Michael Rosen" notification pack from the michael-rosen-says corpus.

Needs that repo's corpus (corpora/michael-rosen: corpus.db and the downloaded videos) and
ffmpeg. From the michael-rosen-says repo root:
    python <this file> <out_dir> [sound ...]

Every sound is a cut of the man himself, picked by clip id from the corpus's word and noise
alignments: the click for a message, "nice" for a mention, and so on. Clip ids are fixed so
the pack rebuilds the same; change them here to swap a take.
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import SR, run  # noqa: E402

CORPUS = os.path.join("corpora", "michael-rosen")
PAD_BEFORE, PAD_AFTER = 0.02, 0.06


def clip(table: str, clip_id: int, length: float = 0.0) -> np.ndarray:
    """One aligned clip, cut from its source video, mono, with short fades at both ends;
    *length* caps it, for a clip whose alignment runs into the next sound."""
    db = sqlite3.connect(os.path.join(CORPUS, "corpus.db"))
    start, end, src = db.execute(
        f"select start_time, end_time, source_file from {table} where id = ?", (clip_id,)
    ).fetchone()
    start = max(0.0, start - PAD_BEFORE)
    dur = end - start + PAD_AFTER
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}",
         "-i", os.path.join(CORPUS, src), "-vn", "-ac", "1", "-ar", str(SR),
         "-af", "highpass=f=70", "-f", "s16le", "-"],
        capture_output=True, check=True).stdout
    y = tighten(np.frombuffer(raw, "<i2").astype(np.float64) / 32768.0)
    if length:
        y = y[: int(length * SR)].copy()
    edge = min(len(y) // 4, int(0.008 * SR))
    if edge > 1:
        y[:edge] *= np.linspace(0.0, 1.0, edge)
        y[-edge:] *= np.linspace(1.0, 0.0, edge)
    return y


def tighten(y: np.ndarray, floor_db: float = -30.0, gap: float = 0.12) -> np.ndarray:
    """Keep only the first sound in the cut: the alignments are loose, and a clip can carry
    room tone ahead of it and the start of the next noise behind it."""
    w = int(0.01 * SR)
    env = np.sqrt(np.convolve(y ** 2, np.ones(w) / w, "same"))
    loud = env > env.max() * 10 ** (floor_db / 20.0)
    on = np.nonzero(loud)[0]
    if not len(on):
        return y
    start, end, quiet = on[0], on[0], 0
    for i in range(on[0], len(y)):
        if loud[i]:
            end, quiet = i, 0
        else:
            quiet += 1
            if quiet > gap * SR:
                break
    return y[max(0, start - w): min(len(y), end + 4 * w)]


def word(clip_id: int) -> np.ndarray:
    return clip("word_clips", clip_id)


def noise(clip_id: int, length: float = 0.0) -> np.ndarray:
    return clip("noise_clips", clip_id, length)


def place(total: float, parts: list[tuple[float, np.ndarray, float]]) -> np.ndarray:
    """Lay clips out on a timeline of *total* seconds: (at, clip, gain)."""
    buf = np.zeros(int(round(total * SR)))
    for at, y, gain in parts:
        i = int(round(at * SR))
        n = min(len(y), len(buf) - i)
        buf[i:i + n] += y[:n] * gain
    return buf


# Clip ids in corpora/michael-rosen/corpus.db.
CLICK, CLICK_2 = 564, 568          # noise_clips
GULP, MMMM, ERM = 595, 569, 611    # noise_clips
NICE, HELLO, RING, QUIET, OKAY, OH = 13750, 10946, 17359, 15932, 17583, 15424  # word_clips


def ring() -> np.ndarray:
    """"Hello?" ... "ring" ... "ring", and a pause; 3 s, loops."""
    r = word(RING)
    return place(3.0, [(0.0, word(HELLO), 1.0), (1.0, r, 0.9), (1.5, r, 0.9)])


def ringback() -> np.ndarray:
    """A long "mmmm", then "erm", while it rings out; 3.2 s, loops."""
    return place(3.2, [(0.0, noise(MMMM), 1.0), (1.4, noise(ERM), 0.9)])


SOUNDS = {
    "message": lambda: noise(CLICK, 0.12),
    "mention": lambda: word(NICE),
    "ring": ring,
    "ringback": ringback,
    "callend": lambda: noise(GULP),
    "mute": lambda: word(QUIET),
    "unmute": lambda: word(OKAY),
    "camera-on": lambda: word(OH),
    "camera-off": lambda: noise(CLICK_2, 0.12),
}

if __name__ == "__main__":
    run(SOUNDS)
