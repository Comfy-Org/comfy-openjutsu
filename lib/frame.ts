function settle(target: EventTarget, name: string) {
  return new Promise<void>((resolve, reject) => {
    target.addEventListener(name, () => resolve(), { once: true });
    target.addEventListener("error", () => reject(new Error("Could not read a frame from this video.")), { once: true });
  });
}

export async function frameAt(video: File, start: number): Promise<Blob> {
  const url = URL.createObjectURL(video);
  const element = document.createElement("video");
  element.muted = true;
  element.preload = "auto";
  element.src = url;
  try {
    await settle(element, "loadeddata");
    const seeked = settle(element, "seeked");
    element.currentTime = start;
    await seeked;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read a frame from this video."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
