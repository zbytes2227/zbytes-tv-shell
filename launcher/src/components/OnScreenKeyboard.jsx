import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Delete, ArrowLeftRight, Check, X } from "lucide-react";

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
  ["SPACE", ".", "-", "_", "@", "/", "OK"],
];

export default function OnScreenKeyboard({
  value,
  onChange,
  onSubmit,
  onCancel,
  title = "Enter text",
  subtitle = "Use arrows and Enter",
  secure = false,
}) {
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);
  const [shift, setShift] = useState(false);

  const rows = useMemo(
    () =>
      ROWS.map((items) =>
        items.map((item) => ({
          key: item,
          label:
            item === "BACK" ? <Delete size={16} /> :
            item === "SHIFT" ? <ArrowLeftRight size={16} /> :
            item === "OK" ? <Check size={16} /> :
            item === "SPACE" ? "Space" :
            item,
        }))
      ),
    []
  );

  const currentRow = rows[row] || rows[0];
  const currentKey = currentRow[col] || currentRow[0];

  useEffect(() => {
    const onKeyDown = (event) => {
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key in map) {
        event.preventDefault();
        if (map[event.key] === "up") {
          setRow((v) => {
            const next = Math.max(0, v - 1);
            setCol((c) => Math.min(c, (rows[next] || []).length - 1));
            return next;
          });
        }
        if (map[event.key] === "down") {
          setRow((v) => {
            const next = Math.min(rows.length - 1, v + 1);
            setCol((c) => Math.min(c, (rows[next] || []).length - 1));
            return next;
          });
        }
        if (map[event.key] === "left") setCol((v) => Math.max(0, v - 1));
        if (map[event.key] === "right") setCol((v) => Math.min((rows[row] || []).length - 1, v + 1));
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();
      activate(currentKey?.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentKey, onCancel, row, rows]);

  function commit(next) {
    onChange?.(next);
  }

  function activate(key) {
    if (!key) return;
    if (key === "BACK") {
      commit(value.slice(0, -1));
      return;
    }
    if (key === "SPACE") {
      commit(`${value} `);
      return;
    }
    if (key === "SHIFT") {
      setShift((v) => !v);
      return;
    }
    if (key === "OK") {
      onSubmit?.();
      return;
    }
    const next = shift ? key.toUpperCase() : key.toLowerCase();
    commit(`${value}${next}`);
    if (shift) setShift(false);
  }

  return createPortal(
    <div className="osk">
      <div className="osk__panel" role="dialog" aria-modal="true" aria-labelledby="osk-title">
        <div className="osk__header">
          <div>
            <p className="osk__eyebrow">{title}</p>
            <h3 id="osk-title">{subtitle}</h3>
          </div>
          <button type="button" className="osk__close" onClick={onCancel} aria-label="Close keyboard">
            <X size={18} />
          </button>
        </div>

        <div className="osk__value">{secure ? "•".repeat(value.length) : value || " "}</div>

        <div className="osk__grid">
          {rows.map((items, r) => (
            <div className="osk__row" key={r}>
              {items.map((item, c) => {
                const isActive = row === r && col === c;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`osk__key ${isActive ? "osk__key--active" : ""} ${item.key === "OK" ? "osk__key--accent" : ""} ${item.key === "BACK" ? "osk__key--danger" : ""} ${item.key === "SHIFT" && shift ? "osk__key--active" : ""}`}
                    onClick={() => activate(item.key)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
