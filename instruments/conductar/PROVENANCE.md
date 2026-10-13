# ConductAR — vendored build

Built from `D:/Projects/tools/ConductorAR` (source fingerprint `6383729d60484a2e`: sha256 over
src/ and package-lock.json), by `tools/vendor-conductorar.mjs`, under the base path `/instruments/conductar/`,
on 2026-09-27.

Do not edit these files. Change the source, then re-run the script.

Nothing in the built app is changed. The MediaPipe runtime's module variant
(vision_wasm_module_internal.*) is left out because the app does not load it.

Files: assets/analysis.worker-wSn0jcwA.js, assets/index-CR6hkia8.css, assets/index-D-NssJ2P.js, index.html, mediapipe/wasm/vision_wasm_internal.js, mediapipe/wasm/vision_wasm_internal.wasm, mediapipe/wasm/vision_wasm_nosimd_internal.js, mediapipe/wasm/vision_wasm_nosimd_internal.wasm, models/hand_landmarker.task, models/pose_landmarker_lite.task, stage.jpg.

The site's audio guard (`/assets/js/audio-guard.js`) is added as the first script in
the page's head, so the site's mute reaches the instrument when it runs in a frame.
