import assert from "node:assert/strict";
import test from "node:test";
import { anchorImage, anchorRequest, ANCHOR_PROMPT } from "../lib/anchor.ts";

test("asks GPT Image to edit the frame with the character, at low quality", () => {
  const body = anchorRequest({ bytes: new Uint8Array([1]), type: "image/png" }, { bytes: new Uint8Array([2]), type: "image/jpeg" });
  assert.equal(body.prompt, ANCHOR_PROMPT);
  assert.deepEqual(body.image, ["data:image/png;base64,AQ==", "data:image/jpeg;base64,Ag=="]);
  assert.equal(body.quality, "low");
});

test("reads the image from a base64, URL or binary answer", async () => {
  assert.deepEqual(await anchorImage({ kind: "json", data: { data: [{ b64_json: "AQI=" }] } } as never), new Uint8Array([1, 2]));
  const download = (async () => new Response(new Uint8Array([3]))) as typeof fetch;
  assert.deepEqual(await anchorImage({ kind: "json", data: { data: [{ url: "https://example.test/a.png" }] } } as never, download), new Uint8Array([3]));
  assert.deepEqual(await anchorImage({ kind: "binary", data: new Uint8Array([4]) } as never), new Uint8Array([4]));
  await assert.rejects(anchorImage({ kind: "json", data: {} } as never), /no image/);
});
