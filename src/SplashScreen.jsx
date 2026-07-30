import React, { useState, useEffect } from "react";
import "./App.css";

export default function SplashScreen({ onFinish }) {
  // Stages: "wave" -> "rotate" -> "logo" -> "fadeout" -> "done"
  const [stage, setStage] = useState("wave");

  useEffect(() => {
    // Stage 1: Medium-slow wave bouncing (0ms - 1300ms)
    const t1 = setTimeout(() => {
      setStage("rotate");
    }, 1300);

    // Stage 2: 90-degree rotation & morphing into logo (1300ms - 2100ms)
    const t2 = setTimeout(() => {
      setStage("logo");
    }, 2100);

    // Stage 3: Logo hold & brand text reveal (2100ms - 2800ms)
    const t3 = setTimeout(() => {
      setStage("fadeout");
    }, 2800);

    // Stage 4: Fadeout complete (3200ms)
    const t4 = setTimeout(() => {
      setStage("done");
      if (onFinish) onFinish();
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinish]);

  if (stage === "done") return null;

  return (
    <div className={`splash-overlay ${stage === "fadeout" ? "splash-overlay--fadeout" : ""}`}>
      {/* Soft Ambient Glow */}
      <div className="splash-glow" />

      <div className="splash-content">
        {/* Morphing Capsule Container */}
        <div className={`splash-capsule splash-capsule--${stage}`}>
          
          {/* Audio Spectrum Bars (rotating 90 degrees during 'rotate' & 'logo' stage) */}
          <div className={`splash-spectrum-grid splash-spectrum-grid--${stage}`}>
            <div className="splash-bar-large splash-bar-l1" />
            <div className="splash-bar-large splash-bar-l2" />
            <div className="splash-bar-large splash-bar-l3" />
            <div className="splash-bar-large splash-bar-l4" />
            <div className="splash-bar-large splash-bar-l5" />
          </div>

          {/* Logo revealing smoothly during rotation */}
          {(stage === "rotate" || stage === "logo" || stage === "fadeout") && (
            <div className={`splash-logo-reveal ${stage !== "wave" ? "splash-logo-reveal--visible" : ""}`}>
              <img src="/tucus_logo.png" alt="Tucus" className="splash-logo-img" />
            </div>
          )}
        </div>

        {/* Brand Text */}
        <div className={`splash-brand ${stage === "logo" || stage === "fadeout" ? "splash-brand--visible" : ""}`}>
          <span className="splash-title">tucus</span>
          <span className="splash-subtitle">music player</span>
        </div>
      </div>
    </div>
  );
}
