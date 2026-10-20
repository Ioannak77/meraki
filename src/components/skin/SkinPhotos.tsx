"use client";

// Check-ins: photos of your skin over time, with a note, and a side-by-side
// comparison of the first and the latest. Photos stay on this device.

import { useEffect, useState } from "react";
import { loadPhoto, shrink } from "@/lib/photos";
import { nextPhotoDue, type SkinPhoto } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { dayKey } from "@/lib/store";
import { Card, CardTitle, DangerButton, Label, PrimaryButton, Sheet, inputClass } from "../finance/ui";

function niceDate(key: string) {
  return new Date(key + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Loads a photo from IndexedDB and shows it. */
export function PhotoImage({ id, className = "" }: { id: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    let alive = true;
    loadPhoto(id).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  if (!url) return <div className={`animate-pulse bg-line ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element -- local blob URL, not a remote image
  return <img src={url} alt="Skin check-in" className={`object-cover ${className}`} />;
}

export function SkinPhotos({ now }: { now: Date }) {
  const { photos, settings } = useSkin();
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<SkinPhoto | null>(null);
  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));
  const due = nextPhotoDue(photos, settings.photoEvery);
  const isDue = !due || due <= dayKey(now);
  const first = sorted[sorted.length - 1];
  const latest = sorted[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardTitle>Skin check-ins</CardTitle>
        <p className="text-[15px] text-muted">
          {isDue
            ? photos.length
              ? "Time for a check-in photo. Same spot and light as last time makes them easy to compare."
              : "Take a first photo to compare against later. Good, even light works best."
            : `Next one ${niceDate(due!)}.`}
        </p>
        <PrimaryButton onClick={() => setAdding(true)}>Take or add a photo</PrimaryButton>
        <p className="mt-2 text-xs text-muted">Photos stay on this device only.</p>
      </Card>

      {first && latest && first.id !== latest.id && (
        <Card className="lg:col-span-2">
          <CardTitle>First vs latest</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {[first, latest].map((p) => (
              <figure key={p.id}>
                <PhotoImage id={p.id} className="aspect-[3/4] w-full rounded-2xl" />
                <figcaption className="mt-1 text-center text-xs text-muted">{niceDate(p.date)}</figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}

      {sorted.length > 0 && (
        <Card className="lg:col-span-2">
          <CardTitle>All check-ins</CardTitle>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
            {sorted.map((p) => (
              <button key={p.id} type="button" onClick={() => setViewing(p)} className="text-left">
                <PhotoImage id={p.id} className="aspect-square w-full rounded-xl" />
                <span className="mt-1 block truncate text-xs text-muted">{niceDate(p.date)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {adding && <AddPhotoSheet now={now} onClose={() => setAdding(false)} />}
      {viewing && <PhotoSheet photo={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AddPhotoSheet({ now, onClose }: { now: Date; onClose: () => void }) {
  const { addPhoto } = useSkin();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(file: File) {
    setError(null);
    try {
      const small = await shrink(file);
      setBlob(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setError("Couldn't read that photo. Try another one.");
    }
  }

  return (
    <Sheet title="Skin check-in" onClose={onClose}>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local preview
        <img src={preview} alt="New check-in" className="max-h-80 w-full rounded-2xl object-cover" />
      ) : (
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-line bg-cream py-10 text-center font-semibold">
          📷 Take a photo or choose one
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />
        </label>
      )}
      {error && <p className="mt-2 text-[15px] text-peach">{error}</p>}
      <Label>How&apos;s your skin? (optional)</Label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. less redness, a breakout on the chin" className={inputClass} />
      <PrimaryButton
        disabled={!blob || saving}
        onClick={async () => {
          if (!blob) return;
          setSaving(true);
          await addPhoto(blob, dayKey(now), note);
          if (preview) URL.revokeObjectURL(preview);
          onClose();
        }}
      >
        {saving ? "Saving…" : "Save check-in"}
      </PrimaryButton>
    </Sheet>
  );
}

function PhotoSheet({ photo, onClose }: { photo: SkinPhoto; onClose: () => void }) {
  const { deletePhoto } = useSkin();
  return (
    <Sheet title={niceDate(photo.date)} onClose={onClose}>
      <PhotoImage id={photo.id} className="max-h-[60vh] w-full rounded-2xl" />
      {photo.note && <p className="mt-3 text-[15px]">{photo.note}</p>}
      <DangerButton
        label="Delete photo"
        onConfirm={async () => {
          await deletePhoto(photo.id);
          onClose();
        }}
      />
    </Sheet>
  );
}
