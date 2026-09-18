"use client";

import { useMemo, useState } from "react";
import type { FrameShape } from "../lib/frames";
import { FRAMES, framesFor } from "../lib/frames";

export function FramePicker({ shape, selected, onSelect, onRemove }: { shape: FrameShape; selected: string | null; onSelect: (id: string) => void; onRemove: () => void }) {
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => ["All", ...Array.from(new Set(FRAMES.filter((frame) => frame.shape === shape).map((frame) => frame.category)))], [shape]);
  const frames = framesFor(shape, category);

  return (
    <div className="frame-picker">
      <div className="chips">
        {categories.map((item) => <button key={item} className={`chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="frame-grid">
        <button className={`frame-card ${selected === null ? "selected" : ""}`} onClick={onRemove}>
          <div className={`frame-thumb empty ${shape}`}>None</div><span>Remove frame</span>
        </button>
        {frames.map((frame) => (
          <button key={frame.id} className={`frame-card ${selected === frame.id ? "selected" : ""}`} onClick={() => onSelect(frame.id)}>
            <div className={`frame-thumb ${shape}`}><img src={frame.src} alt={frame.name} /></div>
            <span>{frame.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
