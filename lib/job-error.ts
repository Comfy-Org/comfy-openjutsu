export function jobErrorMessage(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && typeof Reflect.get(error, "message") === "string"
        ? Reflect.get(error, "message") as string
        : "";
  const missingNode = message.match(/Node ['"]([^'"]+)['"] not found/i)?.[1];
  if (missingNode) {
    return `This Comfy deployment is missing the “${missingNode}” node. Add the custom nodes listed in build/model-files.md, publish a Build release, and redeploy.`;
  }
  return message || "Comfy could not run this workflow. Check the deployment logs and try again.";
}
