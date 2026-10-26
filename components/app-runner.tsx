"use client";

import { useEffect, useMemo, useState } from "react";
import { jobErrorMessage } from "../lib/job-error";
import { frameAt } from "../lib/frame";
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
  const [message, setMessage] = useState("Choose a clip of one continuous shot, at least 5 seconds long.");
  const [error, setError] = useState(false);
  const videoUrl = useObjectUrl(video);
  const characterUrl = useObjectUrl(character);
  const anchorUrl = useObjectUrl(anchor);
  const longest = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, duration - start));

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
        setMessage(next.status === "queued" ? "Waiting for a GPU…" : "Comfy is swapping the character…");
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
    if (job.status === "succeeded") {
      setError(false);
      setMessage("Done. Play or download the result below.");
    } else {
      setError(true);
      setMessage(`${jobErrorMessage(job.error)} (job ${job.id})`);
    }
  }, [job]);

  function chooseVideo(file: File | undefined) {
    setVideo(null); setDuration(0); setJob(null); setAnchor(null); setError(false);
    if (!file) { setMessage("Choose a clip of one continuous shot, at least 5 seconds long."); return; }
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (!(probe.duration >= MIN_SECONDS)) {
        setError(true); setMessage(`Choose a clip at least ${MIN_SECONDS} seconds long.`); return;
      }
      setVideo(file); setDuration(probe.duration); setStart(0);
      setSeconds(Math.min(MAX_SECONDS, Math.floor(probe.duration * 10) / 10));
      setMessage("Clip ready. Add a character image.");
    };
    probe.onerror = () => { URL.revokeObjectURL(url); setError(true); setMessage("Could not read this video. Try an MP4."); };
    probe.src = url;
  }

  function chooseStart(value: number) {
    setStart(value);
    setSeconds((current) => Math.min(current, Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, duration - value))));
  }

  async function firstFrame(): Promise<Blob | null> {
    if (!video || !character || !useAnchor) return null;
    setPhase("anchoring");
    setMessage("Making the first frame with GPT Image…");
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
      setMessage(`${cause instanceof Error ? cause.message : "Could not make the first-frame image."} Swapping without it…`);
      return null;
    }
  }

  async function generate() {
    if (!video || !character || phase !== "idle") return;
    setError(false); setJob(null); setAnchor(null);
    const image = await firstFrame();
    setPhase("submitting");
    if (image || !useAnchor) setMessage("Uploading and starting the swap…");
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
      setJob(next); setPhase("running"); setMessage("Submitted to Comfy. The first run can take a few minutes while the deployment starts.");
    } catch (cause) {
      setPhase("idle"); setError(true);
      setMessage(cause instanceof Error ? cause.message : "Could not submit the workflow.");
    }
  }

  const busy = phase !== "idle";
  const result = job?.status === "succeeded" ? job.outputs.find((output) => /result/i.test(output.name)) : undefined;

  return (
    <main className="shell">
      <header className="masthead">
        <p className="eyebrow">COMFY · API WORKFLOW GUIDE</p>
        <h1>Openjutsu.</h1>
        <p className="lede">Swap the person in a video for the character in one image. The scene, the performance and the clip&apos;s own sound stay.</p>
      </header>

      <section className="studio" aria-label="Openjutsu studio">
        <aside className="controls">
          <label className="field"><span>01 · Video</span><input type="file" accept="video/mp4,video/quicktime" disabled={busy} onChange={(event) => chooseVideo(event.target.files?.[0])} /></label>
          <label className="field"><span>02 · Character image</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { setCharacter(event.target.files?.[0] ?? null); setAnchor(null); }} /></label>
          <fieldset disabled={!video || busy}>
            <legend>03 · Part to swap</legend>
            <label className="field"><span>Starts at · {start.toFixed(1)} s</span><input type="range" min={0} max={Math.max(0, duration - MIN_SECONDS)} step={0.1} value={start} onChange={(event) => chooseStart(Number(event.target.value))} /></label>
            <label className="field"><span>Length · {seconds.toFixed(1)} s</span><input type="range" min={MIN_SECONDS} max={longest} step={0.1} value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} /></label>
          </fieldset>
          <label className="field"><span>Quality</span><select disabled={busy} value={size} onChange={(event) => setSize(event.target.value as SwapSize)}>{Object.keys(SIZES).map((key) => <option key={key}>{key}</option>)}</select></label>
          <label className="field"><span>Extra direction (optional)</span><textarea value={direction} maxLength={500} disabled={busy} onChange={(event) => setDirection(event.target.value)} placeholder="Character details, or a fix for the last take: darker jacket, keep the glasses, less smiling." /></label>
          <label className="field"><span>Seed (blank draws a new one)</span><input inputMode="numeric" value={seed} disabled={busy} onChange={(event) => setSeed(event.target.value.replace(/\D/g, ""))} placeholder="Random" /></label>
          <label className="check"><input type="checkbox" checked={useAnchor} disabled={busy} onChange={(event) => setUseAnchor(event.target.checked)} /> Make a first frame with GPT Image (a separate Comfy Router charge)</label>
          <button type="button" className="primary" disabled={!video || !character || busy} onClick={() => void generate()}>{busy ? "Working…" : "Swap character"}</button>
          <p className={`status${error ? " error" : ""}`} role="status">{message}</p>
        </aside>
        <section className="preview" aria-label="Inputs">
          {result ? <video key={result.id} src={result.url} controls playsInline /> : videoUrl ? <video src={videoUrl} controls muted playsInline /> : <p>Choose a clip and a character image to start.</p>}
          <div className="thumbs">
            {characterUrl && <figure><img src={characterUrl} alt="Character" /><figcaption>Character</figcaption></figure>}
            {anchorUrl && <figure><img src={anchorUrl} alt="First frame made by GPT Image" /><figcaption>First frame</figcaption></figure>}
          </div>
          {result && <a href={result.url} download={result.name}>Download the result</a>}
        </section>
      </section>
    </main>
  );
}
