"""Render candidates for Mudrix's own default sound pack, mixing the ytpmv chip models.

Needs the michael-rosen-says repo (app.ytpmv). From that repo root:
    PYTHONPATH=. python <this file> <out_dir> [candidate ...]

Six directions, each with a message, a mention, a join and a leave. They are meant to sit
nearer Discord's soft, round two-note pops than to a console's menu beeps, built from the same
chips as the other packs (and mixed across them: the Mega Drive's slap bass under NES or
Master System tops).
"""

from __future__ import annotations

import importlib.util
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _common import SR, finish, write_wav  # noqa: E402


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"pack_{name}", os.path.join(HERE, f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_nes, _md, _sms = _load("nes"), _load("megadrive"), _load("sms")
Channel, mixdown = _nes.Channel, _nes.mixdown
Mix, SLAP, BLIP, BELL = _md.Mix, _md.SLAP, _md.BLIP, _md.BELL
Chan, smix = _sms.Chan, _sms.mix


def stack(secs: float, *parts: np.ndarray) -> np.ndarray:
    """Layers of different chips, summed on one timeline."""
    out = np.zeros(int(round(secs * SR)))
    for p in parts:
        n = min(len(p), len(out))
        out[:n] += p[:n]
    return out


def pulse(secs, notes, duty=1, vol=0.7, decay=0.12, sweep=0.0, step=0.07, start=0.0, loop=False):
    ch = Channel("pulse", secs, duty=duty)
    for i, n in enumerate(notes):
        ch.play(start + i * step, 0.2 if i == len(notes) - 1 else step, n, vol=vol, decay=decay,
                sweep=sweep, wrap=loop)
    return mixdown([ch], loop=loop)


def tri(secs, notes, step=0.07, start=0.0, loop=False, last=0.16):
    ch = Channel("triangle", secs)
    for i, n in enumerate(notes):
        ch.play(start + i * step, last if i == len(notes) - 1 else step * 0.95, n, wrap=loop)
    return mixdown([ch], loop=loop)


def slap(secs, notes, step=0.07, gain=0.6, start=0.0, tail=0.2):
    m = Mix(secs)
    for i, n in enumerate(notes):
        m.note(SLAP, n, start + i * step, 0.08, gain=gain, tail=tail)
    return m.buf


def blips(secs, notes, step=0.07, gain=0.8, start=0.0, tail=0.3, loop=False):
    m = Mix(secs)
    for i, n in enumerate(notes):
        m.note(BLIP, n, start + i * step, 0.06, gain=gain, tail=tail, wrap=loop)
    return m.buf


def square(secs, notes, step=0.07, vol=0.6, decay=0.15, detune=0.0, vibrato=0.0, start=0.0):
    a, b = Chan("tone", secs), Chan("tone", secs)
    for i, n in enumerate(notes):
        last = i == len(notes) - 1
        dur = 0.22 if last else step
        a.play(start + i * step, dur, n, vol=vol, decay=decay if last else decay * 0.5, detune=detune, vibrato=vibrato)
        if detune:
            b.play(start + i * step, dur, n, vol=vol * 0.6, decay=decay if last else decay * 0.5, detune=-detune, vibrato=vibrato)
    return smix([a, b] if detune else [a])


def tick(secs, at=0.0, vol=0.5):
    n = Channel("noise", secs, setting=2, mode=1)
    n.play(at, 0.025, 0.0, vol=vol, decay=0.025)
    return mixdown([n], loop=False)


# ── 1. Slap: the Mega Drive's slap bass under a bright NES pulse ──────────────────────────────
def slap_set():
    return {
        "message": lambda: stack(0.5, slap(0.5, ["A2"], gain=0.7), pulse(0.5, ["E5", "A5"], start=0.03, step=0.075)),
        "mention": lambda: stack(0.8, slap(0.8, ["A2", "A2", "E3"], step=0.09, gain=0.65),
                                 pulse(0.8, ["A5", "C#6", "E6", "A6"], start=0.0, step=0.07)),
        "join": lambda: stack(0.5, slap(0.5, ["E2", "A2"], step=0.08), pulse(0.5, ["A4", "E5"], start=0.02, step=0.08)),
        "leave": lambda: stack(0.5, slap(0.5, ["A2", "E2"], step=0.08), pulse(0.5, ["E5", "A4"], start=0.02, step=0.08)),
    }


# ── 2. Bloop: round NES triangle bubbles with a soft echo, the closest to a chat pop ──────────
def bloop_set():
    def bubble(secs, notes, step=0.065):
        echo = pulse(secs, notes, duty=2, vol=0.18, decay=0.18, start=0.09, step=step)
        return stack(secs, tri(secs, notes, step=step), echo)

    return {
        "message": lambda: bubble(0.5, ["E5", "B5"]),
        "mention": lambda: bubble(0.7, ["E5", "G#5", "B5", "E6"], step=0.06),
        "join": lambda: bubble(0.5, ["B4", "E5", "G#5"], step=0.06),
        "leave": lambda: bubble(0.5, ["G#5", "E5", "B4"], step=0.06),
        # Calls: the same bubbles, slower and in phrases. Loops wrap so the seam is clean.
        "ring": lambda: stack(
            2.4,
            tri(2.4, ["E5", "G#5", "B5", "E6", "B5", "G#5", "B5", "E6"], step=0.11, loop=True, last=0.3),
            pulse(2.4, ["E5", "G#5", "B5", "E6", "B5", "G#5", "B5", "E6"], duty=2, vol=0.16, decay=0.2,
                  step=0.11, start=0.13, loop=True)),
        "ringback": lambda: stack(
            3.2,
            tri(3.2, ["B5", "E5"], step=0.2, loop=True, last=0.4) * 0.8
            + tri(3.2, ["B5", "E5"], step=0.2, start=0.9, loop=True, last=0.4) * 0.8),
        "callend": lambda: stack(
            0.9,
            tri(0.9, ["E6", "B5", "G#5", "E5", "B4"], step=0.075, last=0.3),
            pulse(0.9, ["E6", "B5", "G#5", "E5", "B4"], duty=2, vol=0.16, decay=0.2, step=0.075, start=0.1)),
        "mute": lambda: bubble(0.4, ["B5", "E5"], step=0.07),
        "unmute": lambda: bubble(0.4, ["E5", "B5"], step=0.07),
        "camera-on": lambda: stack(0.4, tick(0.4), tri(0.4, ["G#5", "B5"], step=0.06, start=0.04)),
        "camera-off": lambda: stack(0.4, tick(0.4), tri(0.4, ["B5", "G#5"], step=0.06, start=0.04)),
    }


def _bell_loop(secs, notes, loop=True, gain=0.22):
    m = Mix(secs)
    for n, at in notes:
        m.note(BELL, n, at, 0.3, gain=gain, tail=0.5, wrap=loop)
    return m.buf


# ── 3. Glass: Mega Drive FM blips and a bell, a quiet NES triangle holding them up ────────────
def glass_set():
    def glass(secs, notes, step=0.07):
        bell = Mix(secs)
        bell.note(BELL, notes[-1], step * (len(notes) - 1), 0.2, gain=0.22, tail=0.4)
        return stack(secs, blips(secs, notes, step=step), bell.buf, tri(secs, [n[:-1] + str(int(n[-1]) - 1) for n in notes], step=step) * 0.35)

    return {
        "message": lambda: glass(0.6, ["B5", "E6"]),
        "mention": lambda: glass(0.9, ["E5", "G#5", "B5", "E6"], step=0.06),
        "join": lambda: glass(0.6, ["E5", "B5", "G#6"][:3], step=0.06),
        "leave": lambda: glass(0.6, ["G#6", "B5", "E5"], step=0.06),
        "ring": lambda: stack(
            2.4,
            blips(2.4, ["E5", "G#5", "B5", "E6", "B5", "G#5", "B5", "E6"], step=0.11, loop=True, tail=0.35),
            _bell_loop(2.4, [("E4", 0.0), ("B4", 0.55)])),
        "ringback": lambda: stack(
            3.2,
            blips(3.2, ["B5", "E5"], step=0.18, gain=0.6, loop=True, tail=0.45),
            blips(3.2, ["B5", "E5"], step=0.18, start=0.9, gain=0.6, loop=True, tail=0.45)),
        "callend": lambda: stack(
            1.1,
            blips(1.1, ["E6", "B5", "G#5", "E5"], step=0.08, tail=0.3),
            _bell_loop(1.1, [("E4", 0.25)], loop=False, gain=0.3)),
        "mute": lambda: blips(0.5, ["B5", "E5"], step=0.07),
        "unmute": lambda: blips(0.5, ["E5", "B5"], step=0.07),
        "camera-on": lambda: stack(0.5, tick(0.5), blips(0.5, ["G#5", "B5"], step=0.06, start=0.04)),
        "camera-off": lambda: stack(0.5, tick(0.5), blips(0.5, ["B5", "G#5"], step=0.06, start=0.04)),
    }


# ── 4. Funk: a slap bass line with Master System square stabs on the offbeats ─────────────────
def funk_set():
    return {
        "message": lambda: stack(0.45, slap(0.45, ["E2", "G2"], step=0.07, gain=0.65), square(0.45, ["B4"], start=0.035, decay=0.1)),
        "mention": lambda: stack(0.9, slap(0.9, ["E2", "E3", "G2", "A2"], step=0.1, gain=0.65),
                                 square(0.9, ["B4", "E5", "G5"], start=0.05, step=0.1, decay=0.12)),
        "join": lambda: stack(0.5, slap(0.5, ["E2", "G2", "B2"], step=0.065), square(0.5, ["E5", "G5", "B5"], start=0.03, step=0.065, decay=0.1)),
        "leave": lambda: stack(0.5, slap(0.5, ["B2", "G2", "E2"], step=0.065), square(0.5, ["B5", "G5", "E5"], start=0.03, step=0.065, decay=0.1)),
    }


# ── 5. Warm: two Master System squares a few cents apart, slow chorus, a little vibrato ───────
def warm_set():
    return {
        "message": lambda: square(0.6, ["D5", "A5"], step=0.09, detune=9, vibrato=0.2, decay=0.3),
        "mention": lambda: square(0.9, ["D5", "F#5", "A5", "D6"], step=0.08, detune=9, vibrato=0.2, decay=0.35),
        "join": lambda: square(0.6, ["A4", "D5", "F#5"], step=0.08, detune=9, vibrato=0.2, decay=0.3),
        "leave": lambda: square(0.6, ["F#5", "D5", "A4"], step=0.08, detune=9, vibrato=0.2, decay=0.3),
    }


# ── 6. Hybrid: a noise tick, a slap, a pulse and a triangle, all four at once ────────────────
def hybrid_set():
    def hit(secs, notes, bass, step=0.07):
        return stack(secs, tick(secs, vol=0.4), slap(secs, bass, step=step, gain=0.55),
                     pulse(secs, notes, duty=2, vol=0.5, decay=0.14, start=0.03, step=step),
                     tri(secs, [n[:-1] + str(int(n[-1]) + 1) if i == 0 else n for i, n in enumerate(notes)], start=0.03, step=step) * 0.5)

    return {
        "message": lambda: hit(0.5, ["C5", "G5"], ["C2"]),
        "mention": lambda: hit(0.8, ["C5", "E5", "G5", "C6"], ["C2", "C3"], step=0.07),
        "join": lambda: hit(0.5, ["G4", "C5", "E5"], ["C2", "G2"], step=0.065),
        "leave": lambda: hit(0.5, ["E5", "C5", "G4"], ["G2", "C2"], step=0.065),
    }


CANDIDATES = {
    "1-slap": slap_set,
    "2-bloop": bloop_set,
    "3-glass": glass_set,
    "4-funk": funk_set,
    "5-warm": warm_set,
    "6-hybrid": hybrid_set,
}

if __name__ == "__main__":
    out = sys.argv[1]
    only = set(sys.argv[2:])
    for cand, build in CANDIDATES.items():
        if only and cand not in only:
            continue
        os.makedirs(os.path.join(out, cand), exist_ok=True)
        for kind, fn in build().items():
            y = finish(fn(), kind)
            write_wav(__import__("pathlib").Path(out) / cand / f"{kind}.wav", y)
            print(f"{cand:9s} {kind:8s} {len(y) / SR:4.2f}s")
