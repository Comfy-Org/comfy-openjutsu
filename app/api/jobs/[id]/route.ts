import { NextResponse } from "next/server";
import { getJob } from "../../../../lib/comfy";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJob(id);

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check job." },
      { status: 502 },
    );
  }
}
