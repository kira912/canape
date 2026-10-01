// Browsers without a native BarcodeDetector (Safari, Firefox, desktop Chrome on
// Linux/Windows) decode with zxing's WebAssembly, which expo-camera loads through
// `barcode-detector`. By default that .wasm comes from the jsDelivr CDN: serve our
// own copy instead (copied to the site root by scripts/build-web.mjs) — no third
// party sees the visit, and it follows our cache headers.
import { setZXingModuleOverrides } from "barcode-detector";

setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/${path}` : prefix + path),
});
