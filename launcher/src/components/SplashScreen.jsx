import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";

/**
 * SplashScreen — cinematic boot animation for ZBYTES OS.
 *
 * Phases:
 *   'boot'   → 0–350ms  : Pure black canvas. Silent.
 *   'reveal' → 350–1700ms: Letters stagger in from below with metallic gradient.
 *              A horizontal rule extends from center simultaneously.
 *              Ambient bloom behind wordmark fades in.
 *   'hold'   → 1700–2700ms: Tagline letter-spacing expands in. Subtle particle breath.
 *   'exit'   → 2700–3500ms: Whole composition fades and scales very slightly in.
 *              Progress line completes. Background dissolves.
 *
 * After exit finishes, onComplete() unmounts this component.
 */
export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState("boot");
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);

  const stableComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Phase transitions
    const t1 = setTimeout(() => setPhase("reveal"),  350);
    const t2 = setTimeout(() => setPhase("hold"),   1700);
    const t3 = setTimeout(() => setPhase("exit"),   2700);
    const t4 = setTimeout(() => stableComplete(),   3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [stableComplete]);

  // Smooth progress bar — increments from 0 → 100 over the total duration
  useEffect(() => {
    const totalDuration = 3500;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const raw = elapsed / totalDuration;
      // Ease-in-out curve so it feels organic, not mechanical
      const eased = raw < 0.5
        ? 2 * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      const pct = Math.min(eased * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        progressRef.current = requestAnimationFrame(tick);
      }
    };

    progressRef.current = requestAnimationFrame(tick);
    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, []);

  /* Generate subtle particle field once */
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: 5 + Math.random() * 90,
        y: 5 + Math.random() * 90,
        size: 1 + Math.random() * 2,
        dur: 8 + Math.random() * 10,
        delay: Math.random() * 4,
        opacity: 0.06 + Math.random() * 0.14,
      })),
    []
  );

  const letters = "ZBYTES".split("");
  const isRevealed  = phase === "reveal" || phase === "hold" || phase === "exit";
  const isHeld      = phase === "hold"   || phase === "exit";
  const isExiting   = phase === "exit";

  return (
    <div
      className={`splash ${isExiting ? "splash--exit" : ""}`}
      aria-hidden="true"
      aria-label="ZBYTES OS loading"
    >
      {/* Ambient background bloom — sits behind everything */}
      <div className={`splash__bloom ${isRevealed ? "splash__bloom--visible" : ""}`} />

      {/* Very subtle particle field */}
      <div className="splash__particles" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="splash__particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: isHeld ? p.opacity : 0,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Center composition */}
      <div className="splash__center">
        {/* Horizontal rule that extends from center */}
        <div className={`splash__rule ${isRevealed ? "splash__rule--visible" : ""}`} />

        {/* ZBYTES wordmark */}
        <h1 className="splash__brand" aria-label="ZBYTES">
          {letters.map((ch, i) => (
            <span
              key={i}
              className={`splash__letter ${isRevealed ? "splash__letter--revealed" : ""}`}
              style={{ "--i": i }}
            >
              {ch}
            </span>
          ))}
        </h1>

        {/* Tagline */}
        <p className={`splash__tagline ${isHeld ? "splash__tagline--visible" : ""}`}>
          Premium TV Experience
        </p>
      </div>

      {/* Progress line — bottom of screen */}
      <div className="splash__progress-track" aria-hidden="true">
        <div
          className="splash__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
