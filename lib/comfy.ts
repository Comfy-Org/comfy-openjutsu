import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Comfy, comfy, type Job } from "@comfyorg/sdk";
import { swapWorkflow, type Graph, type SwapRequest } from "./swap";
import { anchorImage, ANCHOR_MODEL, anchorRequest } from "./anchor";

export type JobOutput = { id: string; name: string; type: string; url: string };
export type PublicJob = { id: string; status: string; outputs: JobOutput[]; error: unknown };

function client() {
  const apiKey = process.env.COMFY_API_KEY?.trim();
  if (!apiKey) throw new Error("COMFY_API_KEY is not configured.");
  return new Comfy({ apiKey, clientInfo: "comfy-openjutsu" });
}

function publicJob(job: Job): PublicJob {
  return {
    id: job.id,
    status: job.status,
    outputs: job.outputs.map((output) => ({
      id: output.id,
      name: output.name,
      type: output.type,
      url: `/api/jobs/${job.id}/outputs/${output.id}`,
    })),
    error: job.error,
  };
}

async function bytes(file: File) {
  return new Uint8Array(await file.arrayBuffer());
}

export async function makeAnchor(frame: File, character: File): Promise<Uint8Array> {
  const result = await comfy.models.run(ANCHOR_MODEL, anchorRequest(
    { bytes: await bytes(frame), type: frame.type || "image/png" },
    { bytes: await bytes(character), type: character.type || "image/png" },
  ));
  return await anchorImage(result);
}

export async function submitSwap(
  files: { video: File; character: File; anchor?: File },
  settings: Omit<SwapRequest, "video" | "character" | "anchor">,
) {
  const api = client();
  const asset = async (file: File, fallbackType: string) =>
    api.assets.fromBytes(await bytes(file), { filename: file.name, contentType: file.type || fallbackType });
  const template = JSON.parse(await readFile(join(process.cwd(), "workflows", "swap.api.json"), "utf8")) as Graph;
  const graph = swapWorkflow(template, {
    ...settings,
    video: await asset(files.video, "video/mp4"),
    character: await asset(files.character, "image/png"),
    anchor: files.anchor ? await asset(files.anchor, "image/png") : undefined,
  });
  return publicJob(await api.submit(api.workflows.fromJson(graph)));
}

export async function getJob(id: string) {
  return publicJob(await client().jobs.get(id));
}

export async function getOutput(jobId: string, outputId: string) {
  const job = await client().jobs.get(jobId);
  const output = job.outputs.find((candidate) => candidate.id === outputId);
  if (!output) throw new Error("Output not found on this job.");
  const { url } = await output.getDownloadUrl();
  return fetch(url);
}
