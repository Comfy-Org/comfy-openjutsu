import assert from "node:assert/strict";
import test from "node:test";
import { jobErrorMessage } from "../lib/job-error.ts";

test("explains a missing deployment node", () => {
  assert.match(
    jobErrorMessage("comfyui /prompt 400: Node 'Prepare clip' not found. Node ID '#2'"),
    /missing.*Prepare clip.*build\/model-files\.md.*redeploy/i,
  );
});
