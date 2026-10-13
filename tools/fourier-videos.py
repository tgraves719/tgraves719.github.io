"""
The particle field listens to YouTube videos by reading ahead.

A YouTube player's sound is sealed inside YouTube's frame, where no page can hear
it. But these videos are Thomas's own recordings, and their audio is on disk. This
reads each one the way site-audio.js reads a playing song -- the energy of 84 notes,
C1 to B7, from spectral peaks; the attacks; low, mid and high bands -- and writes it
to assets/fourier/<video id>.json. When the video plays, video-listen.js follows the
player's clock and hands the field the same reading at the same moment.

    python tools/fourier-videos.py              # every video in tools/fourier-videos.json
    python tools/fourier-videos.py <video id>   # one

tools/fourier-videos.json maps a YouTube id to the local file uploaded as that video.
The file must be the upload itself (same start), or the field will run early or late.
"""
import base64, json, subprocess, sys
from pathlib import Path
import numpy as np

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "assets" / "fourier"
FF = r"C:/Program Files/Virtual Desktop Streamer/ffmpeg.exe"
SR, FFT, FPS, K = 44100, 8192, 15, 10
LOW_MIDI, NOTES = 24, 84


def decode(path):
    raw = subprocess.run([FF, "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def analyse(x):
    hop = SR // FPS
    frames = max(1, (len(x) - FFT) // hop + 1)
    win = np.hanning(FFT).astype(np.float32)
    hz = SR / FFT
    note_bins = []
    for n in range(NOTES):
        f = 440 * 2 ** ((LOW_MIDI + n - 69) / 12)
        a = max(1, int(np.floor(f * 2 ** (-1 / 24) / hz)))
        b = max(a, int(np.ceil(f * 2 ** (1 / 24) / hz)))
        note_bins.append((a, b))
    med_bins = np.arange(note_bins[0][0], note_bins[-1][1] + 1, 3)
    flo, fhi = int(np.ceil(30 / hz)), int(5000 / hz)
    bands = {"low": (int(np.ceil(20 / hz)), int(150 / hz)), "mid": (int(np.ceil(150 / hz)), int(2000 / hz)),
             "high": (int(np.ceil(2000 / hz)), int(8000 / hz))}

    notes = np.full((frames, K, 2), 255, np.uint8)
    level = np.zeros(frames, np.uint8)
    band_out = {k: np.zeros(frames, np.uint8) for k in bands}
    band_max = {k: 1e-9 for k in bands}
    onsets, hist = [], []
    note_max, prev_db, prev_raw, since = 1e-9, None, np.zeros(NOTES), 99
    decay = 0.996 ** (60 / FPS)            # the browser's per-frame decay, at this frame rate

    for i in range(frames):
        seg = x[i * hop: i * hop + FFT]
        if len(seg) < FFT:
            seg = np.pad(seg, (0, FFT - len(seg)))
        mag = np.abs(np.fft.rfft(seg * win)) / (FFT / 2)
        med = np.median(mag[med_bins])
        raw = np.array([max(0.0, mag[a:b + 1].max() - 3 * med) for a, b in note_bins])
        note_max = max(note_max * decay, raw.max(), 1e-9)
        t = (raw / note_max) ** 1.6
        top = np.argsort(t)[::-1][:K]
        top = top[t[top] > 0.02]
        notes[i, :len(top), 0] = top
        notes[i, :len(top), 1] = np.round(t[top] * 255)
        level[i] = round(min(1.0, float(np.sqrt(np.mean(seg ** 2))) * 4) * 255)
        for k, (a, b) in bands.items():
            r = float(np.sqrt(np.mean(mag[a:b + 1] ** 2)))
            band_max[k] = max(band_max[k] * 0.997 ** (60 / FPS), r, 1e-9)
            band_out[k][i] = round(min(1.0, r / band_max[k]) * 255)
        # attacks: positive change in the log spectrum, against its last ~0.7 s
        db = 20 * np.log10(mag[flo:fhi + 1] + 1e-7)
        if prev_db is not None:
            flux = float(np.maximum(0, db - prev_db).mean())
            hist.append(flux); hist = hist[-11:]
            m, sd = float(np.mean(hist)), float(np.std(hist))
            since += 1
            if len(hist) > 5 and flux > m + 1.4 * sd and since > 2:
                since = 0
                gain = raw - prev_raw
                best = int(np.argmax(gain)) if gain.max() > 0 else int(np.argmax(raw))
                onsets.append([round(i / FPS, 3), LOW_MIDI + best, round(min(1.0, (flux - m) / (3 * sd + 1e-3)), 2)])
        prev_db, prev_raw = db, raw

    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    return {"v": 1, "fps": FPS, "frames": frames, "k": K, "lowMidi": LOW_MIDI,
            "notes": b64(notes), "level": b64(level),
            "low": b64(band_out["low"]), "mid": b64(band_out["mid"]), "high": b64(band_out["high"]),
            "onsets": onsets}


def main():
    videos = json.loads((SITE / "tools" / "fourier-videos.json").read_text(encoding="utf8"))
    want = sys.argv[1:] or [k for k in videos if not k.startswith("_")]
    OUT.mkdir(parents=True, exist_ok=True)
    for vid in want:
        path = Path(videos[vid])
        data = analyse(decode(path))
        (OUT / f"{vid}.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf8")
        print(f"{vid}: {data['frames'] / FPS / 60:.1f} min, {len(data['onsets'])} attacks  <- {path.name}", flush=True)
    index = sorted(p.stem for p in OUT.glob("*.json") if p.stem != "index")
    (OUT / "index.json").write_text(json.dumps(index), encoding="utf8")


if __name__ == "__main__":
    main()
