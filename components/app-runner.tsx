"use client";

import { useEffect, useMemo, useState } from "react";
import { jobErrorMessage } from "../lib/job-error";
import { frameAt } from "../lib/frame";
import { EXAMPLES, exampleUrl, type Example } from "../lib/examples";
import { MAX_SECONDS, MIN_SECONDS, SIZES, type SwapSize } from "../lib/swap";

type Output = { id: string; name: string; type: string; url: string };
type Job = { id: string; status: string; outputs: Output[]; error?: { message?: string } | string | null };
type Phase = "idle" | "anchoring" | "submitting" | "running";

const ACTIVE = ["queued", "running", "pending"];

function useObjectUrl(file: Blob | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function videoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(probe.duration); };
    probe.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this video. Try an MP4.")); };
    probe.src = url;
  });
}

async function exampleFile(file: string, type: string) {
  const response = await fetch(`/api/examples/${file}`);
  if (!response.ok) throw new Error("Could not load the example.");
  return new File([await response.blob()], file, { type });
}

function UploadTile(props: {
  label: string;
  hint?: string;
  accept: string;
  disabled: boolean;
  preview?: string;
  isVideo?: boolean;
  caption?: string;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  if (props.preview) {
    return (
      <div className="tile filled">
        {props.isVideo ? <video src={props.preview} muted playsInline /> : <img src={props.preview} alt={props.label} />}
        {props.caption && <span className="tile-caption">{props.caption}</span>}
        <button type="button" className="tile-clear" aria-label={`Remove ${props.label.toLowerCase()}`} disabled={props.disabled} onClick={props.onClear}>×</button>
      </div>
    );
  }
  return (
    <label className="tile">
      <input type="file" accept={props.accept} disabled={props.disabled} onChange={(event) => props.onPick(event.target.files?.[0])} />
      <span className="tile-icon" aria-hidden>{props.isVideo ? "▶" : "+"}</span>
      <span className="tile-label">{props.label}</span>
      {props.hint && <span className="tile-hint">{props.hint}</span>}
    </label>
  );
}

export function AppRunner() {
  const [video, setVideo] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [character, setCharacter] = useState<File | null>(null);
  const [start, setStart] = useState(0);
  const [seconds, setSeconds] = useState(MIN_SECONDS);
  const [size, setSize] = useState<SwapSize>("768p");
  const [direction, setDirection] = useState("");
  const [seed, setSeed] = useState("");
  const [useAnchor, setUseAnchor] = useState(true);
  const [anchor, setAnchor] = useState<Blob | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [pollRetry, setPollRetry] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const videoUrl = useObjectUrl(video);
  const characterUrl = useObjectUrl(character);
  const anchorUrl = useObjectUrl(anchor);
  const longest = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, duration - start));
  const busy = phase !== "idle";
  const result = job?.status === "succeeded" ? job.outputs.find((output) => /result/i.test(output.name)) : undefined;

  useEffect(() => {
    if (!job || !ACTIVE.includes(job.status)) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}`);
        const next = await response.json() as Job & { error?: string };
        if (!response.ok) throw new Error(typeof next.error === "string" ? next.error : "Could not check job status.");
        setJob(next);
        setPollRetry(0);
        setError(false);
        setMessage(next.status === "queued" ? "Waiting for a GPU…" : "Swapping the character…");
      } catch (cause) {
        setError(true);
        setMessage(cause instanceof Error ? cause.message : "Could not check job status.");
        setPollRetry((retry) => retry + 1);
      }
    }, pollRetry ? 5000 : 3000);
    return () => window.clearTimeout(timer);
  }, [job, pollRetry]);

  useEffect(() => {
    if (!job || ACTIVE.includes(job.status)) return;
    setPhase("idle");
    if (job.status === "succeeded") { setError(false); setMessage(""); }
    else { setError(true); setMessage(`${jobErrorMessage(job.error)} (job ${job.id})`); }
  }, [job]);

  async function chooseVideo(file: File | undefined) {
    setVideo(null); setDuration(0); setJob(null); setAnchor(null); setError(false); setMessage("");
    if (!file) return;
    try {
      const length = await videoDuration(file);
      if (!(length >= MIN_SECONDS)) throw new Error(`Choose a clip at least ${MIN_SECONDS} seconds long.`);
      setVideo(file); setDuration(length); setStart(0);
      setSeconds(Math.min(MAX_SECONDS, Math.floor(length * 10) / 10));
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : "Could not read this video.");
    }
  }

  function chooseCharacter(file: File | undefined) {
    setCharacter(file ?? null); setAnchor(null); setJob(null);
  }

  async function chooseExample(example: Example) {
    setError(false); setMessage("Loading the example…");
    try {
      const [clip, person] = await Promise.all([
        exampleFile(`${example.id}.mp4`, "video/mp4"),
        exampleFile(`${example.character}.jpg`, "image/jpeg"),
      ]);
      await chooseVideo(clip);
      chooseCharacter(person);
      setMessage("");
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : "Could not load the example.");
    }
  }

  function chooseStart(value: number) {
    setStart(value);
    setSeconds((current) => Math.min(current, Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, duration - value))));
  }

  async function firstFrame(): Promise<Blob | null> {
    if (!video || !character || !useAnchor) return null;
    setPhase("anchoring");
    setMessage("Making the first frame…");
    try {
      const form = new FormData();
      form.set("frame", new File([await frameAt(video, start)], "frame.png", { type: "image/png" }));
      form.set("character", character);
      const response = await fetch("/api/anchor", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Could not make the first-frame image.");
      }
      const image = await response.blob();
      setAnchor(image);
      return image;
    } catch (cause) {
      setMessage(`${cause instanceof Error ? cause.message : "Could not make the first frame."} Swapping without it…`);
      return null;
    }
  }

  async function generate() {
    if (!video || !character || busy) return;
    setError(false); setJob(null); setAnchor(null);
    const image = await firstFrame();
    setPhase("submitting");
    if (image || !useAnchor) setMessage("Uploading…");
    const form = new FormData();
    form.set("video", video);
    form.set("character", character);
    if (image) form.set("anchor", new File([image], "anchor.png", { type: "image/png" }));
    form.set("start", String(start));
    form.set("seconds", String(seconds));
    form.set("size", size);
    form.set("direction", direction);
    form.set("seed", seed);
    try {
      const response = await fetch("/api/jobs", { method: "POST", body: form });
      const next = await response.json() as Job & { error?: string };
      if (!response.ok) throw new Error(next.error || "Could not submit the workflow.");
      setJob(next); setPhase("running"); setMessage("Waiting for a GPU…");
    } catch (cause) {
      setPhase("idle"); setError(true);
      setMessage(cause instanceof Error ? cause.message : "Could not submit the workflow.");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Comfy</span>
        <span className="divider" aria-hidden />
        <span className="title">Openjutsu</span>
        <span className="badge">BETA</span>
        <a className="topbar-link" href="https://github.com/Comfy-Org/comfy-openjutsu" target="_blank" rel="noreferrer">Source on GitHub ↗</a>
      </header>

      <div className="layout">
        <aside className="panel">
          <UploadTile
            label="Upload video" hint="MP4 or MOV · up to 15 s is used" accept="video/mp4,video/quicktime" isVideo
            disabled={busy} preview={videoUrl} caption={video ? `${video.name} · ${seconds.toFixed(seconds % 1 ? 1 : 0)} s` : undefined}
            onPick={(file) => void chooseVideo(file)} onClear={() => void chooseVideo(undefined)}
          />
          {video && (
            <div className="part">
              <label><span>Start · {start.toFixed(1)} s</span><input type="range" min={0} max={Math.max(0, duration - MIN_SECONDS)} step={0.1} value={start} disabled={busy} onChange={(event) => chooseStart(Number(event.target.value))} /></label>
              <label><span>Length · {seconds.toFixed(1)} s</span><input type="range" min={MIN_SECONDS} max={longest} step={0.1} value={seconds} disabled={busy} onChange={(event) => setSeconds(Number(event.target.value))} /></label>
            </div>
          )}
          <UploadTile
            label="Add a character image" accept="image/png,image/jpeg,image/webp"
            disabled={busy} preview={characterUrl}
            onPick={chooseCharacter} onClear={() => chooseCharacter(undefined)}
          />
          <textarea value={direction} maxLength={500} disabled={busy} onChange={(event) => setDirection(event.target.value)} placeholder="Optional: add character details or fix the last take, e.g. darker jacket, keep the glasses, less smiling." />
          <select value={size} disabled={busy} onChange={(event) => setSize(event.target.value as SwapSize)} aria-label="Quality">
            {Object.keys(SIZES).map((key) => <option key={key}>{key}</option>)}
          </select>
          <input inputMode="numeric" value={seed} disabled={busy} onChange={(event) => setSeed(event.target.value.replace(/\D/g, ""))} placeholder="Random seed" aria-label="Seed" />
          <label className="check"><input type="checkbox" checked={useAnchor} disabled={busy} onChange={(event) => setUseAnchor(event.target.checked)} /> First frame with GPT Image</label>
          <button type="button" className="run" disabled={!video || !character || busy} onClick={() => void generate()}>{busy ? "Working…" : "Swap character"}</button>
          <p className="note">The original sound is kept on the result.{useAnchor ? " The first frame is a separate Comfy Router charge." : ""}</p>
        </aside>

        <main className="stage">
          {result ? (
            <div className="viewer">
              <video key={result.id} src={result.url} controls autoPlay playsInline />
              <div className="viewer-bar">
                {anchorUrl && <img src={anchorUrl} alt="First frame" title="First frame" />}
                <a className="download" href={result.url} download={result.name}>Download</a>
              </div>
            </div>
          ) : videoUrl ? (
            <div className="viewer">
              <video src={videoUrl} controls muted playsInline />
              {anchorUrl && <div className="viewer-bar"><img src={anchorUrl} alt="First frame" title="First frame" /></div>}
            </div>
          ) : (
            <section className="examples">
              <h2>Start with an example</h2>
              <div className="example-grid">
                {EXAMPLES.map((example) => (
                  <button type="button" key={example.id} className="example" disabled={busy} onClick={() => void chooseExample(example)}>
                    <img className="example-poster" src={exampleUrl(`${example.id}.jpg`)} alt="" />
                    <img className="example-character" src={exampleUrl(`${example.character}.jpg`)} alt="" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {message && <p className={`status${error ? " error" : ""}`} role="status">{message}</p>}
        </main>
      </div>
    </div>
  );
}
