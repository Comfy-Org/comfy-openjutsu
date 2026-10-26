import { NextResponse } from "next/server";
import { submitSwap } from "../../../lib/comfy";
import { readSettings } from "../../../lib/swap";
import { readImage, readOptionalImage, readVideo } from "../../../lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let files: Parameters<typeof submitSwap>[0];
  let settings: ReturnType<typeof readSettings>;
  try {
    const form = await request.formData();
    files = {
      video: readVideo(form.get("video")),
      character: readImage(form.get("character"), "a character image"),
      anchor: readOptionalImage(form.get("anchor"), "the first-frame image"),
    };
    settings = readSettings(form);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Check the clip and settings." }, { status: 400 });
  }

  try {
    return NextResponse.json(await submitSwap(files, settings), { status: 202 });
  } catch (error) {
    const missingApiKey = error instanceof Error && error.message.includes("COMFY_API_KEY");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit job." },
      { status: missingApiKey ? 503 : 502 },
    );
  }
}
