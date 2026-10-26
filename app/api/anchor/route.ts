import { makeAnchor } from "../../../lib/comfy";
import { readImage } from "../../../lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let frame: File;
  let character: File;
  try {
    const form = await request.formData();
    frame = readImage(form.get("frame"), "the first frame");
    character = readImage(form.get("character"), "a character image");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Send a frame and a character image." }, { status: 400 });
  }

  try {
    const anchor = await makeAnchor(frame, character);
    return new Response(Buffer.from(anchor), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not make the first-frame image." }, { status: 502 });
  }
}
