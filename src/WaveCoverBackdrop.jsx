import { useEffect, useRef } from "react";

export default function WaveCoverBackdrop({ thumbnail, isPlaying, analyserRef }) {
  const bgRef = useRef(null);

  useEffect(() => {
    let animId;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      const el = bgRef.current;
      if (!el) return;

      const analyser = analyserRef?.current || null;
      if (!isPlaying || !analyser) {
        el.style.transform = "scale(1.12)";
        el.style.opacity = thumbnail ? "0.55" : "0";
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      let bassSum = 0;
      for (let i = 0; i < 4; i++) bassSum += data[i] || 0;
      const bass = bassSum / 4 / 255;

      let midSum = 0;
      for (let i = 4; i < 16; i++) midSum += data[i] || 0;
      const mid = midSum / 12 / 255;

      el.style.transform = `scale(${1.1 + bass * 0.1}) rotate(${bass * 2 - 1}deg)`;
      el.style.opacity = `${0.42 + bass * 0.28 + mid * 0.08}`;
      el.style.filter = `blur(110px) saturate(${1.8 + bass * 0.8}) brightness(${0.22 + bass * 0.12})`;
    };

    tick();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, analyserRef, thumbnail]);

  if (!thumbnail) return <div className="wave-bg-art wave-bg-art--empty" />;

  return (
    <>
      <div
        ref={bgRef}
        className={`wave-bg-art ${isPlaying ? "wave-bg-art--playing" : ""}`}
        style={{ backgroundImage: `url(${thumbnail})` }}
      />
      <div className="wave-bg-overlay" />
    </>
  );
}
