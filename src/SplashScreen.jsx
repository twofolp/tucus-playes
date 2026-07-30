import React, { useState, useEffect } from "react";
import "./App.css";

export default function SplashScreen({ onFinish }) {
  const [stage, setStage] = useState("spectrum"); // "spectrum" -> "logo" -> "fadeout" -> "done"

  useEffect(() => {
    // Stage 1: Spectrum bouncing (0ms - 1050ms)
    const t1 = setTimeout(() => {
      setStage("logo");
    }, 1050);

    // Stage 2: Logo display (1050ms - 1850ms)
    const t2 = setTimeout(() => {
      setStage("fadeout");
    }, 1850);

    // Stage 3: Complete fade out (2250ms)
    const t3 = setTimeout(() => {
      setStage("done");
      if (onFinish) onFinish();
    }, 2250);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  if (stage === "done") return null;

  return (
    <div className={`splash-overlay ${stage === "fadeout" ? "splash-overlay--fadeout" : ""}`}>
      {/* Radial Background Glow */}
      <div className="splash-glow" />

      <div className="splash-content">
        {/* Dynamic Island Style Container */}
        <div className={`splash-island ${stage === "logo" || stage === "fadeout" ? "splash-island--expanded" : ""}`}>
          
          {/* Phase 1: Minimalist Apple-style Spectrum */}
          {stage === "spectrum" && (
            <div className="splash-spectrum-bars">
              <div className="splash-bar splash-bar-1" />
              <div className="splash-bar splash-bar-2" />
              <div className="splash-bar splash-bar-3" />
              <div className="splash-bar splash-bar-4" />
              <div className="splash-bar splash-bar-5" />
            </div>
          )}

          {/* Phase 2: Logo revealing */}
          {(stage === "logo" || stage === "fadeout") && (
            <div className="splash-logo-wrap">
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
