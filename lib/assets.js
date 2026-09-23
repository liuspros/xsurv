import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// Tries to load a real .glb/.gltf model from /public. Returns null (never
// throws) if the file doesn't exist yet, so callers can fall back to a
// procedural placeholder. Drop your Mixamo / Kenney / Sketchfab exports
// into /public/models and this will pick them up automatically.
export function tryLoadModel(url) {
  return new Promise((resolve) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      () => resolve(null)
    );
  });
}

// Tries to fetch + decode a real audio file from /public/sounds. Returns
// null on any failure (missing file, bad format) so callers can fall back
// to the procedural synthesized sound.
export async function tryLoadAudioBuffer(audioCtx, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    return null;
  }
}
