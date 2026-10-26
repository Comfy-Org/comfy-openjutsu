import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readSettings, swapPrompt, swapWorkflow, type Graph } from "../lib/swap.ts";

const template = JSON.parse(readFileSync(new URL("../workflows/swap.api.json", import.meta.url), "utf8")) as Graph;
const request = {
  video: "clip.mp4",
  character: "hero.png",
  direction: "  keep the glasses  ",
  start: 2.5,
  seconds: 5,
  size: "768p" as const,
  seed: 42,
};

test("binds the clip, the character and the chosen part", () => {
  const graph = swapWorkflow(template, request);
  assert.equal(graph["30"].inputs.file, "clip.mp4");
  assert.equal(graph["9"].inputs.image, "hero.png");
  assert.deepEqual(graph.trim.inputs.video, ["30", 0]);
  assert.equal(graph.trim.inputs.start_time, 2.5);
  assert.equal(graph.trim.inputs.duration, 5);
  assert.deepEqual(graph["31"].inputs.video, ["trim", 0]);
  assert.deepEqual(graph["803"].inputs.source_video, ["trim", 0]);
});

test("asks PrepareVideo for the quality as a number", () => {
  assert.equal(swapWorkflow(template, { ...request, size: "480p" })["31"].inputs.resolution, 480);
  assert.equal(swapWorkflow(template, request)["31"].inputs.resolution, 768);
  assert.equal(swapWorkflow(template, { ...request, seconds: 9.4 })["31"].inputs.duration_seconds, 9.4);
});

test("runs the v1.5 swap LoRA and saves a video", () => {
  const graph = swapWorkflow(template, request);
  assert.equal(graph["850"].inputs.lora_name, "h3_character_swap_v1.5.safetensors");
  assert.equal(graph["801"].inputs.seed, 42);
  assert.deepEqual(graph["809"].inputs.video, ["808", 0]);
});

test("uses the first frame through a crop when there is one", () => {
  const graph = swapWorkflow(template, { ...request, anchor: "anchor.png" });
  assert.equal(graph.anchor_image.inputs.image, "anchor.png");
  assert.deepEqual(graph["803"].inputs.anchor, ["anchor_fit", 0]);
  assert.equal(graph["803"].inputs.use_anchor, true);
  assert.match(String(graph["801"].inputs.prompt), /<Picture 2>/);
});

test("drops the first-frame nodes when there is none", () => {
  const graph = swapWorkflow(template, request);
  assert.equal(graph.anchor_image, undefined);
  assert.equal(graph.anchor_fit, undefined);
  assert.equal(graph["803"].inputs.anchor, undefined);
  assert.equal(graph["803"].inputs.use_anchor, false);
  assert.ok(template.anchor_image, "the template stays untouched");
});

test("starts the prompt with the workflow's instruction", () => {
  assert.equal(
    swapPrompt("  keep the glasses  ", false),
    "Replace the selected person in <Video 1> with the character in <Picture 1>. Preserve the source performance, scene and audio timing. keep the glasses",
  );
  assert.match(swapPrompt("", true), /Start from the first frame in <Picture 2>\.$/);
});

test("reads and checks the settings", () => {
  const form = (entries: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  };
  assert.deepEqual(readSettings(form({ start: "1.234", seconds: "5", size: "480p", seed: "7", direction: "x" })), {
    start: 1.23, seconds: 5, size: "480p", seed: 7, direction: "x",
  });
  assert.ok(Number.isInteger(readSettings(form({ seconds: "5", size: "768p" })).seed));
  assert.throws(() => readSettings(form({ seconds: "4", size: "768p" })), /between 5 and 15/);
  assert.throws(() => readSettings(form({ seconds: "16", size: "768p" })), /between 5 and 15/);
  assert.throws(() => readSettings(form({ seconds: "5", size: "1080p" })), /480p or 768p/);
  assert.throws(() => readSettings(form({ seconds: "5", size: "768p", seed: "1.5" })), /whole-number seed/);
});
