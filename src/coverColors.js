const DEFAULT_PALETTE = { color1: "#6366f1", color2: "#ec4899" };

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function boostColor(r, g, b) {
  const max = Math.max(r, g, b);
  const boost = max < 110 ? 170 / (max || 1) : 1;
  return [
    Math.min(255, r * boost),
    Math.min(255, g * boost),
    Math.min(255, b * boost),
  ];
}

export function extractCoverPalette(imageUrl, onPalette) {
  if (!imageUrl) {
    onPalette(DEFAULT_PALETTE);
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 10, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;

      const samples = [];
      for (let i = 0; i < 100; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const lum = (r + g + b) / 3;
        if (sat > 0.12 && lum > 25 && lum < 240) {
          samples.push({ r, g, b, sat, lum });
        }
      }

      if (samples.length < 2) {
        onPalette(DEFAULT_PALETTE);
        return;
      }

      samples.sort((a, b) => b.sat - a.sat || b.lum - a.lum);
      const first = boostColor(samples[0].r, samples[0].g, samples[0].b);

      let secondSample = samples[1];
      for (let i = 1; i < samples.length; i++) {
        const dr = Math.abs(samples[i].r - samples[0].r);
        const dg = Math.abs(samples[i].g - samples[0].g);
        const db = Math.abs(samples[i].b - samples[0].b);
        if (dr + dg + db > 80) {
          secondSample = samples[i];
          break;
        }
      }

      const second = boostColor(secondSample.r, secondSample.g, secondSample.b);
      onPalette({
        color1: rgbToHex(...first),
        color2: rgbToHex(...second),
      });
    } catch {
      onPalette(DEFAULT_PALETTE);
    }
  };
  img.onerror = () => onPalette(DEFAULT_PALETTE);
  img.src = imageUrl;
}
