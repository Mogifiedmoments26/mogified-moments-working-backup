"use client";

import { useMemo, useState } from "react";
import type { FrameShape } from "../lib/frames";
import { FRAMES, framesFor } from "../lib/frames";

type FramePickerProps = {
  shape: FrameShape;
  selected: string | null;
  onSelect: (id: string) => void;
  onRemove: () => void;
};

export function FramePicker({
  shape,
  selected,
  onSelect,
  onRemove,
}: FramePickerProps) {
  const [category, setCategory] =
    useState("All");

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          FRAMES.filter(
            (frame) => frame.shape === shape
          ).map((frame) => frame.category)
        )
      ),
    ];
  }, [shape]);

  const frames = framesFor(shape, category);

  return (
    <div className="frame-picker">
      <div className="chips">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={`chip ${
              category === item ? "active" : ""
            }`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="frame-grid">
        <button
          type="button"
          className={`frame-card ${
            selected === null ? "selected" : ""
          }`}
          onClick={onRemove}
        >
          <div
            className={`frame-thumb empty ${shape}`}
          >
            None
          </div>

          <span>Remove frame</span>
        </button>

        {frames.map((frame) => (
          <button
            type="button"
            key={frame.id}
            className={`frame-card ${
              selected === frame.id
                ? "selected"
                : ""
            }`}
            onClick={() =>
              onSelect(frame.id)
            }
          >
            <div
              className={`frame-thumb ${shape}`}
            >
              <img
                src={frame.src}
                alt={frame.name}
              />
            </div>

            <span>{frame.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}