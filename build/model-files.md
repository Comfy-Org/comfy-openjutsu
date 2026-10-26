# Openjutsu Build inputs

Prepare this ComfyUI version, node pack, and model files before creating the deployment Build.

Use ComfyUI `98cc0bf84b` (v0.41.0), which contains the MiniMax H3, SAM 3.1 and video nodes used by the workflow:

```sh
git -C /path/to/ComfyUI checkout 98cc0bf84b7cb1383654c5b402e7612d875d6d22
```

## Custom nodes

The workflow uses Akatz Labs' `h3_character_swap` node pack, which lives in a subfolder of [akatz-labs/h3-character-swap-tool](https://github.com/akatz-labs/h3-character-swap-tool). Copy that folder at the revision this guide was tested on, then apply [`h3_character_swap.patch`](h3_character_swap.patch):

```sh
git clone --filter=blob:none --no-checkout https://github.com/akatz-labs/h3-character-swap-tool.git /tmp/h3-character-swap-tool
git -C /tmp/h3-character-swap-tool sparse-checkout set worker_nodes/h3_character_swap
git -C /tmp/h3-character-swap-tool checkout 0670e4fdf95adf2262caa4b81afed2a9c4ae4b7b
cp -R /tmp/h3-character-swap-tool/worker_nodes/h3_character_swap /path/to/ComfyUI/custom_nodes/
cd /path/to/ComfyUI/custom_nodes/h3_character_swap
git apply -p1 /path/to/comfy-openjutsu/build/h3_character_swap.patch
```

The patch makes two changes, recorded in the pack's `SOURCE_PROVENANCE.json`:

- The Comfy Build image has no `ffmpeg` or `ffprobe`. The pack puts the bundled `imageio-ffmpeg` binary on `PATH` and reads stream facts with PyAV instead of `ffprobe`.
- `H3CharacterSwapPrepareVideo.resolution` takes the numbers `480` and `768` instead of strings. This app sends numbers.

The node pack is GPL-3.0, and so is the patch. See [`THIRD_PARTY_NOTICES`](../THIRD_PARTY_NOTICES).

## Model files

| File in workflow | Place under `models/` | Source repository |
| --- | --- | --- |
| `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | `diffusion_models/` | [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3) |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `text_encoders/` | [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3) |
| `minimax_h3_video_vae_fp16.safetensors` | `vae/` | [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3) |
| `minimax_h3_audio_vae_fp32.safetensors` | `vae/` | [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3) |
| `sam3.1_multiplex_fp16.safetensors` | `checkpoints/` | [Comfy-Org/sam3.1](https://huggingface.co/Comfy-Org/sam3.1) |
| `h3_character_swap_v1.5.safetensors` | `loras/` | [akatz-ai/MiniMax-H3-Character-Swap-LoRA](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA) |
| `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` | `loras/` | [lightx2v/Minimax-h3-Turbo](https://huggingface.co/lightx2v/Minimax-h3-Turbo) |

Some model repositories require access approval. Follow each model card's terms and do not commit the weights. If a node reports a missing Python package, install it from that node's `requirements.txt` in the ComfyUI environment and rebuild.

Run these commands from the ComfyUI root (the folder that contains `models/`). Install the Hugging Face CLI if needed. If a model repository requires login, run `hf auth login` first:

```sh
cd /path/to/ComfyUI
python -m pip install -U huggingface_hub
hf download Comfy-Org/MiniMax-H3 diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors --revision 1c41cfca8ebba91d0af792a05c5761fb2c3a7975 --local-dir models
hf download Comfy-Org/MiniMax-H3 text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors --revision 1c41cfca8ebba91d0af792a05c5761fb2c3a7975 --local-dir models
hf download Comfy-Org/MiniMax-H3 vae/minimax_h3_video_vae_fp16.safetensors --revision 1c41cfca8ebba91d0af792a05c5761fb2c3a7975 --local-dir models
hf download Comfy-Org/MiniMax-H3 vae/minimax_h3_audio_vae_fp32.safetensors --revision 1c41cfca8ebba91d0af792a05c5761fb2c3a7975 --local-dir models
hf download Comfy-Org/sam3.1 checkpoints/sam3.1_multiplex_fp16.safetensors --revision 7bb8374780a725b4353ed31f3a9395c9742b5621 --local-dir models
hf download akatz-ai/MiniMax-H3-Character-Swap-LoRA h3_character_swap_v1.5.safetensors --revision d06323b7c8e70e97cdab48b78a1e05f786c8cba9 --local-dir models/loras
hf download lightx2v/Minimax-h3-Turbo minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors --revision 3ec17a324ced54151364f24f8b5fb6bf7e26414f --local-dir models/loras
```

After downloading the files, run `comfy build init` from this ComfyUI root to capture them in `comfy-build.yaml`.

## Licences

MiniMax H3 and the character-swap LoRA are under the MiniMax H3 Community License. Its standard grant excludes some regions, including the US, EU, UK and South Korea; read the licence on the model card before you deploy. SAM 3.1 is under the SAM License. The Turbo LoRA is Apache-2.0.
