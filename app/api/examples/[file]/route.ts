import { exampleFiles, exampleUrl } from "../../../../lib/examples";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!exampleFiles.has(file)) return Response.json({ error: "No such example." }, { status: 404 });
  const response = await fetch(exampleUrl(file));
  if (!response.ok || !response.body) return Response.json({ error: "Could not load the example." }, { status: 502 });
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
