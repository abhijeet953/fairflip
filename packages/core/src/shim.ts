import { defaultEntropy } from "./entropy";

const _originalRandom = Math.random.bind(Math);
let _shimInstalled = false;

export function installShim(): void {
  if (_shimInstalled) return;

  Math.random = function cryptoRandom(): number {
    const buf = new Uint8Array(8);
    const entropy = defaultEntropy(7);
    buf.set(entropy, 0);

    const view = new DataView(new ArrayBuffer(8));
    const hi = ((buf[6] & 0x0f) * 0x100000000 + ((buf[5] << 24 | buf[4] << 16 | buf[3] << 8 | buf[2]) >>> 0));
    const lo = (buf[1] << 24 | buf[0] << 16) >>> 0;
    view.setUint32(0, (hi & 0x000fffff) | 0x3ff00000, false);
    view.setUint32(4, lo, false);
    return view.getFloat64(0, false) - 1.0;
  };

  _shimInstalled = true;
}

export function uninstallShim(): void {
  if (!_shimInstalled) return;
  Math.random = _originalRandom;
  _shimInstalled = false;
}

export function isShimInstalled(): boolean {
  return _shimInstalled;
}

// Auto-install on import
installShim();
