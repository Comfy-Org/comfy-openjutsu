export const EXAMPLE_BASE = "https://media.comfy.org/website/workshop/openjutsu/examples";

export type Example = { id: string; character: string };

export const EXAMPLES: Example[] = [
  { id: "singer", character: "diva" },
  { id: "boxer", character: "comfy-tee" },
  { id: "painter", character: "ronin" },
  { id: "cowboy", character: "chrome-robot" },
];

export const exampleFiles = new Set(
  EXAMPLES.flatMap((example) => [`${example.id}.mp4`, `${example.id}.jpg`, `${example.character}.jpg`]),
);

export const exampleUrl = (file: string) => `${EXAMPLE_BASE}/${file}`;
