"""
Import the Safeway Strike 2025 recordings into the site.

    python tools/import-strike-audio.py ["D:/Music/Safeway Strike 2025"]

Copies each mp3 unchanged (no re-encoding) to audio/safeway-strike-2025/, drops
byte-identical duplicates, reads each duration with ffmpeg, and writes
_data/strikePlaylist.json. Titles come from the filenames, which carry the variant
numbers ("Safeway Strike Song 2"); the files' title tags drop them.
Order: the playlist introduction first, then by title -- edit the JSON to reorder;
the page follows it.

ffmpeg: set FFMPEG, or it looks on PATH and then in Virtual Desktop Streamer.
"""
import hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "D:/Music/Safeway Strike 2025")
SITE = Path(__file__).resolve().parent.parent
DEST = SITE / "audio" / "safeway-strike-2025"
ART = SITE / "images" / "strike" / "tracks"   # each track's own cover, from its tags
FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or r"C:/Program Files/Virtual Desktop Streamer/ffmpeg.exe"

def probe(f):
    e = subprocess.run([FF, "-hide_banner", "-i", str(f)], capture_output=True, text=True, encoding="utf8", errors="replace").stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", e).groups()
    title = re.search(r"^\s{4}title\s*:\s*(.+)$", e, re.M)
    artist = re.search(r"^\s{4}artist\s*:\s*(.+)$", e, re.M)
    return int(h) * 3600 + int(m) * 60 + float(s), (title.group(1).strip() if title else None), (artist.group(1).strip() if artist else None)

def clean(name):
    return re.sub(r"^[_\s]+|[_\s]+$", "", name)

def slug(t):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", t.lower())).strip("-")

shutil.rmtree(DEST, ignore_errors=True)   # a clean copy: nothing stale survives
shutil.rmtree(ART, ignore_errors=True)
DEST.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)
seen, tracks, artists = {}, [], set()
# originals before their " (1)" copies, so a duplicate keeps its real name
copy = re.compile(r" \(\d+\)$")
for f in sorted(SRC.glob("*.mp3"), key=lambda f: (copy.sub("", f.stem), bool(copy.search(f.stem)))):
    digest = hashlib.md5(f.read_bytes()).hexdigest()
    if digest in seen:
        print(f"skip duplicate: {f.name} (same bytes as {seen[digest]})")
        continue
    seen[digest] = f.name
    seconds, tag_title, artist = probe(f)
    title = clean(f.stem)
    if artist: artists.add(artist)
    out = slug(title) + ".mp3"
    n = 2
    while (DEST / out).exists() and out in {Path(t["file"]).name for t in tracks}:
        out = f"{slug(title)}-{n}.mp3"; n += 1
    shutil.copyfile(f, DEST / out)
    track = {"title": title, "file": f"/audio/safeway-strike-2025/{out}", "seconds": round(seconds, 1)}
    art = ART / (Path(out).stem + ".jpg")
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(f), "-an", "-map", "0:v:0", "-c", "copy", str(art)], capture_output=True)
    if art.exists() and art.stat().st_size: track["image"] = f"/images/strike/tracks/{art.name}"
    tracks.append(track)

key = lambda t: (0 if "introduction" in t["title"].lower() else 1, re.sub(r"^[^\w]+", "", t["title"]).lower())
tracks.sort(key=key)
shutil.copyfile(SRC / "Folder.jpg", SITE / "images" / "strike" / "cover.jpg")
data = {"artist": " / ".join(sorted(artists)), "cover": "/images/strike/cover.jpg", "tracks": tracks}
(SITE / "_data" / "strikePlaylist.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(f"{len(tracks)} tracks, {sum(t['seconds'] for t in tracks) / 60:.0f} min, "
      f"{sum((DEST / Path(t['file']).name).stat().st_size for t in tracks) / 2**20:.0f} MB -> {DEST}")
