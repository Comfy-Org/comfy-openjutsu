import type { RunResult } from "@comfyorg/sdk";

export const ANCHOR_MODEL = "openai/gpt-image-2.5-sunburst";

export const ANCHOR_PROMPT =
  "Replace the person in image 1 with the character from image 2, including their face, hair, body and complete outfit exactly as shown in image 2. Do not keep any of the original person's clothing. Keep image 1's pose, framing, background and lighting.";

type Image = { bytes: Uint8Array; type: string };

const dataUrl = (image: Image) => `data:${image.type};base64,${Buffer.from(image.bytes).toString("base64")}`;

export function anchorRequest(frame: Image, character: Image) {
  return {
    prompt: ANCHOR_PROMPT,
    image: [dataUrl(frame), dataUrl(character)],
    quality: "low",
    size: "auto",
    n: 1,
    moderation: "auto",
  };
}

export async function anchorImage(result: RunResult, download: typeof fetch = fetch): Promise<Uint8Array> {
  if (result.kind === "binary") return result.data;
  const first = (result.data as { data?: { b64_json?: string; url?: string }[] } | null)?.data?.[0];
  if (first?.b64_json) return new Uint8Array(Buffer.from(first.b64_json, "base64"));
  if (first?.url) {
    const response = await download(first.url);
    if (!response.ok) throw new Error(`Could not download the first-frame image (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error("GPT Image returned no image.");
}
