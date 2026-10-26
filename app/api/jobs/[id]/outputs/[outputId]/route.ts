import { getOutput } from "../../../../../../lib/comfy";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; outputId: string }> }) {
  try {
    const { id, outputId } = await params;
    const output = await getOutput(id, outputId);
    if (!output.ok || !output.body) return Response.json({ error: "Output is not ready." }, { status: 502 });
    return new Response(output.body, {
      headers: {
        "Content-Type": output.headers.get("Content-Type") ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to download output." }, { status: 502 });
  }
}
