# Comfy Openjutsu

A standalone app for swapping the person in a video for the character in one image, with a Comfy workflow. Upload a clip and a character image, choose a 5 to 15 second part, and get the part back with the character in it. The scene, the performance and the clip's own sound stay.

It is the app behind [Openjutsu on comfy.org](https://comfy.org/hub/apps/openjutsu/), built on Akatz Labs' [H3 Character Swap](https://github.com/akatz-labs/h3-character-swap-tool) workflow and MiniMax H3.

You need a Comfy Developer Platform account, an [API key](https://platform.comfy.org/profile/api-keys?onboarding=comfy_api), and a deployment with the nodes and models listed in [`build/model-files.md`](build/model-files.md). The workflow was run on a 96 GB GPU (RTX PRO 6000); smaller configurations have not been tested. Generation uses deployment credits, and the optional first frame is a separate Comfy Router charge.

## Run the app

1. Install [Node.js 22.6 or newer](https://nodejs.org/). Prepare a Comfy Developer Platform deployment with the patched `h3_character_swap` node pack, MiniMax H3, SAM 3.1 and the two LoRAs by following [`build/model-files.md`](build/model-files.md). Cloning this repo does not create that deployment.
2. Copy this repository and make local settings:

   ```sh
   git clone https://github.com/Comfy-Org/comfy-openjutsu.git
   cd comfy-openjutsu
   cp .env.example .env.local
   ```

3. Add the API key for the workspace that owns your deployment to `COMFY_API_KEY`. Set `COMFY_BASE_URL` to the deployment URL from the Developer Platform; the SDK reads both variables from `.env.local` on the server.
4. Install and start the app:

   ```sh
   npm ci
   npm run dev
   ```

5. Open <http://localhost:3000>. Pick one of the examples, or choose a clip of one continuous shot with a person in its first frame, and a character image. Pick where the part starts and how long it is, then select **Swap character**.

The first job may take several minutes while the deployment starts and loads its models; a 5 second part at 480p took about two minutes on a warm worker. The server reads the key from `.env.local`; do not expose it in a `NEXT_PUBLIC_` variable or commit the file.

## Comfy workflow

**Swap character** submits `workflows/swap.api.json`. `lib/swap.ts` fills it in: the clip goes to node `30`, the character image to node `9`, the part's start and length to the `trim` node and node `31`, the quality to node `31` (`480` or `768`), and the prompt and seed to node `801`. The server uploads the files with the SDK and submits the graph; node `809` saves the result, which the page plays from `/api/jobs/<id>/outputs/<output>`.

Every prompt starts with the workflow's own instruction, using H3's reference tags, and then adds the optional extra direction:

> Replace the selected person in `<Video 1>` with the character in `<Picture 1>`. Preserve the source performance, scene and audio timing.

### The first frame

Before the swap, the page takes the frame where the part starts and posts it with the character image to `/api/anchor`. The server asks GPT Image 2.5 (`openai/gpt-image-2.5-sunburst`, quality `low`) through Comfy Router to put the character, outfit included, into that frame, using the same `COMFY_API_KEY`. The swap then starts from that image (the `anchor_image` and `anchor_fit` nodes), which carries the character's look from the first frame. If it fails, or you untick it, the swap runs without it and those two nodes are removed. See `lib/anchor.ts`.

### Changes from Akatz's workflow

The graph is `workflows/H3 Character Swap.api.json` from [akatz-labs/h3-character-swap-tool](https://github.com/akatz-labs/h3-character-swap-tool) at `0670e4f`, with these changes:

| Change | Why |
| --- | --- |
| Swap LoRA v1 to `h3_character_swap_v1.5` | Akatz's recommended release. |
| `Video Slice` (`trim`) in front of nodes 31 and 803 | The app chooses where the part starts. |
| The optional anchor node (309) replaced by `LoadImage` and `ImageScale` | Uploaded files fail node 309's own validation on a deployment; core `LoadImage` takes them, and `ImageScale` center-crops the first frame to the prepared size. |
| `CreateVideo` and `SaveVideo` after node 807 | A deployment reports only standard outputs. |
| Mask preview (111, 112) removed | Not needed by the app. |

Every other setting is Akatz's: 8 steps, CFG 1, `er_sde`, 124-frame windows with 18 frames of history, a 64 px mask expansion, and SAM finding the largest person.

## Change the app

The form and its defaults are in `components/app-runner.tsx`, styled in `app/globals.css`. The four examples are the ones on comfy.org, read from `media.comfy.org` through `/api/examples`; change the list in `lib/examples.ts`. `lib/swap.ts` holds the part limits, the qualities and the prompt, and `lib/anchor.ts` the first-frame prompt.

To edit the workflow, open it in ComfyUI and export **Workflow (API)**. Replace `workflows/swap.api.json` and update the node ids in `lib/swap.ts` if they moved. If the change adds a model or custom node, add it to the Comfy build and publish a new release before running the app.

## Build the Comfy environment

The deployment Build must include every node and model used by the workflow. The versions, files, and download commands are in [`build/model-files.md`](build/model-files.md).

Install the Comfy CLI and sign in to the Comfy account for your deployment. Run these commands from the prepared ComfyUI folder containing `models/` and `custom_nodes/`:

```sh
pip install comfy-cli
comfy setup --where cloud
cd /path/to/ComfyUI
comfy build init --name comfy-openjutsu --models-dir ./models --custom-nodes-dir ./custom_nodes
comfy build status
comfy build push --release --target linux/nvidia
comfy deploy refs compute
```

Create a deployment from the released Build, choose an available GPU and region, and put its URL in `.env.local`. Stop or delete the deployment when you finish to end GPU charges.

These commands package the local ComfyUI install; they do not download model files. After deployment, run one 5 second swap at 480p and confirm a video comes back.

## Limits

- Clips up to 100 MB, MP4 or MOV; the part is 5 to 15 seconds.
- The clip should be one continuous shot. A hard cut breaks the swap at the cut.
- SAM looks for a person in the part's first frame. A part that opens on a frame with no person (a fade from black, a title card) fails before it generates.
- With several people, the largest one is swapped.
- A silent clip gives a silent result.
- Reloading the page clears the current job and result from the UI.

## License

MIT. See [`LICENSE`](LICENSE). The workflow is derived from Akatz Labs' MIT-licensed workflow, and the node-pack patch in `build/` is GPL-3.0 like the pack it changes; both notices are in [`THIRD_PARTY_NOTICES`](THIRD_PARTY_NOTICES). Model licenses are separate; see the end of [`build/model-files.md`](build/model-files.md).
