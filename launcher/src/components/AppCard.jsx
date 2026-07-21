import React from "react";
import BrandIcon from "./BrandIcon.jsx";

/**
 * AppCard — single Smart TV launcher tile.
 * - isFocused : driven by parent grid state (keyboard/remote control)
 * - onHover   : syncs mouse hover back into parent's focusedIndex
 * - tabIndex={-1}: all focus is managed programmatically by AppGrid
 */
export default function AppCard({ app, isFocused, onSelect, onHover, cardRef, entranceDelay }) {
  // X (Twitter) is black — use a visible charcoal so the tinted
  // container isn't invisible on our dark canvas.
  const accentColor = app.color === "#000000" ? "#4a4a5a" : (app.color || "#4F7EFF");

  return (
    <button
      ref={cardRef}
      className={`app-card ${isFocused ? "app-card--focused" : ""} app-card--entrance`}
      style={{
        "--accent": accentColor,
        "--entrance-delay": `${entranceDelay}s`,
      }}
      onClick={() => onSelect(app)}
      onMouseEnter={onHover}
      tabIndex={-1}
      aria-label={app.name}
    >
      {/* Top-edge focus indicator bar */}
      <div className="app-card__focus-bar" aria-hidden="true" />

      {/* Gloss highlight (top-left quadrant) */}
      <div className="app-card__gloss" aria-hidden="true" />

      {/* Icon container */}
      <div className="app-card__icon-wrap">
        <div className="app-card__icon-glow" aria-hidden="true" />
        <BrandIcon app={app} size={52} />
      </div>

      {/* Label */}
      <span className="app-card__label">{app.name}</span>
    </button>
  );
}
