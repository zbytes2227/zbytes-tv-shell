import React, { useEffect, useRef, useState, useCallback } from "react";
import AppCard from "./AppCard.jsx";
import { Settings2 } from "lucide-react";

// Dynamic grid columns implemented via state to match CSS breakpoints
export default function AppGrid({
  apps,
  onLaunch,
  onOpenSettings,
  savedIndex,
  onSaveIndex,
}) {
  const totalItems = apps.length + 1; // +1 for Settings card
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const saved = savedIndex ?? 0;
    return Math.min(saved, totalItems - 1);
  });
  const [gridCols, setGridCols] = useState(5);
  const cardRefs = useRef([]);

  useEffect(() => {
    const updateCols = () => {
      const width = window.innerWidth;
      if (width <= 520) setGridCols(2);
      else if (width <= 768) setGridCols(3);
      else if (width <= 1024) setGridCols(3);
      else if (width <= 1280) setGridCols(4);
      else setGridCols(5);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  // Push real DOM focus whenever focusedIndex changes
  useEffect(() => {
    const el = cardRefs.current[focusedIndex];
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: false });
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIndex]);

  // Save index when unmounting (navigating to Settings)
  useEffect(() => {
    return () => {
      onSaveIndex?.(focusedIndex);
    };
  }, [focusedIndex, onSaveIndex]);

  const moveFocus = useCallback((newIndex) => {
    const bounded = Math.max(0, Math.min(totalItems - 1, newIndex));
    setFocusedIndex(bounded);
  }, [totalItems]);

  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          moveFocus(focusedIndex + 1);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          moveFocus(focusedIndex - 1);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          moveFocus(focusedIndex + gridCols);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          moveFocus(focusedIndex - gridCols);
          break;
        }
        case "Enter": {
          e.preventDefault();
          triggerSelect(focusedIndex);
          break;
        }
        default:
          break;
      }
    },
    [focusedIndex, moveFocus, gridCols]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function triggerSelect(index) {
    if (index === apps.length) {
      onOpenSettings?.();
      return;
    }
    onLaunch(apps[index]);
  }

  return (
    <div className="app-grid-section">
      {/* Section label */}
      <div className="app-grid-section__header" aria-hidden="true">
        <span className="app-grid-section__label">All Apps</span>
        <span className="app-grid-section__line" />
      </div>

      {/* Card grid */}
      <div
        className="app-grid"
        style={{ "--grid-columns": gridCols }}
        role="grid"
        aria-label="Applications"
      >
        {apps.map((app, index) => (
          <AppCard
            key={app.id}
            app={app}
            isFocused={focusedIndex === index}
            onSelect={() => {
              setFocusedIndex(index);
              onLaunch(app);
            }}
            onHover={() => setFocusedIndex(index)}
            cardRef={(el) => (cardRefs.current[index] = el)}
            entranceDelay={index * 0.045}
          />
        ))}

        {/* Settings card — always last */}
        <button
          ref={(el) => (cardRefs.current[apps.length] = el)}
          className={`app-card ${focusedIndex === apps.length ? "app-card--focused" : ""} app-card--entrance`}
          style={{
            "--accent": "#6B7A99",
            "--entrance-delay": `${apps.length * 0.045}s`,
          }}
          onClick={() => {
            setFocusedIndex(apps.length);
            onOpenSettings?.();
          }}
          onMouseEnter={() => setFocusedIndex(apps.length)}
          tabIndex={-1}
          aria-label="Settings"
        >
          <div className="app-card__focus-bar" aria-hidden="true" />
          <div className="app-card__gloss" aria-hidden="true" />
          <div className="app-card__icon-wrap">
            <div className="app-card__icon-glow" aria-hidden="true" />
            <Settings2
              size={52}
              strokeWidth={1.75}
              className="app-card__icon"
              aria-hidden="true"
            />
          </div>
          <span className="app-card__label">Settings</span>
        </button>
      </div>
    </div>
  );
}
