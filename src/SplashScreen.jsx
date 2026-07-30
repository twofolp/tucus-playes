import React, { useState, useEffect } from "react";
import "./App.css";

export default function SplashScreen({ onFinish }) {
  const [fadeout, setFadeout] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Start fadeout after wave sequence completes (~1500ms)
    const t1 = setTimeout(() => {
      setFadeout(true);
    }, 1550);

    // Unmount and notify parent (~1950ms)
    const t2 = setTimeout(() => {
      setDone(true);
      if (onFinish) onFinish();
    }, 1950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onFinish]);

  if (done) return null;

  return (
    <div className={`splash-overlay ${fadeout ? "splash-overlay--fadeout" : ""}`}>
      {/* Background Glow */}
      <div className="splash-glow" />

      <div className="splash-content">
        {/* Main Logo Card with 3-Level Bar Pulse Wave Overlay */}
        <div className="splash-logo-card">
          <img src="/tucus_logo.png" alt="Tucus" className="splash-logo-main" />

          {/* Sequential 3-Bar Pulse Wave (Top -> Middle -> Bottom) */}
          <div className="splash-pulse-overlay">
            <div className="splash-pulse-bar splash-pulse-top" />
            <div className="splash-pulse-bar splash-pulse-mid" />
            <div className="splash-pulse-bar splash-pulse-bot" />
          </div>
        </div>

        {/* Welcome Typography */}
        <div className="splash-welcome-box">
          <div className="splash-welcome-title">TUCUS</div>
          <div className="splash-welcome-subtitle">welcome</div>
        </div>
      </div>
    </div>
  );
}
