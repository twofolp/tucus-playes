import React, { useState, useEffect } from "react";
import "./App.css";

export default function SplashScreen({ onFinish }) {
  const [fadeout, setFadeout] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Start smooth fadeout at ~1600ms
    const t1 = setTimeout(() => {
      setFadeout(true);
    }, 1600);

    // Complete unmount at ~2050ms
    const t2 = setTimeout(() => {
      setDone(true);
      if (onFinish) onFinish();
    }, 2050);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onFinish]);

  if (done) return null;

  return (
    <div className={`splash-overlay ${fadeout ? "splash-overlay--fadeout" : ""}`}>
      {/* Ambient background glow */}
      <div className="splash-glow" />

      <div className="splash-content">
        {/* Pure original logo floating with smooth wave motion (NO card, NO frame, NO overlay) */}
        <div className="splash-logo-pure-wrap">
          <img src="/tucus_logo.png" alt="Tucus" className="splash-logo-pure" />
        </div>

        {/* Minimalist Welcome Typography */}
        <div className="splash-welcome-box">
          <div className="splash-welcome-title">TUCUS</div>
          <div className="splash-welcome-subtitle">welcome</div>
        </div>
      </div>
    </div>
  );
}
