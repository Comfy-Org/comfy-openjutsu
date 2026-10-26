export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function readVideo(value: FormDataEntryValue | null): File {
  if (!(value instanceof File) || value.size === 0) throw new Error("Choose a video clip.");
  if (!VIDEO_TYPES.includes(value.type)) throw new Error("Upload an MP4 or MOV video.");
  if (value.size > MAX_VIDEO_BYTES) throw new Error("Keep clips under 100 MB.");
  return value;
}

export function readImage(value: FormDataEntryValue | null, what: string): File {
  if (!(value instanceof File) || value.size === 0) throw new Error(`Choose ${what}.`);
  if (!IMAGE_TYPES.includes(value.type)) throw new Error(`Use a PNG, JPEG or WebP for ${what}.`);
  if (value.size > MAX_IMAGE_BYTES) throw new Error(`Keep ${what} under 20 MB.`);
  return value;
}

export function readOptionalImage(value: FormDataEntryValue | null, what: string): File | undefined {
  return value instanceof File && value.size > 0 ? readImage(value, what) : undefined;
}
