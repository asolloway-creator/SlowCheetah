'use client';

import { PRESETS, type Preset } from '@/lib/calc';
import { planSentence } from '@/lib/format';

/** Three radio tiles, each with a one-line shape generated from the preset itself. */
export default function PresetTiles({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (p: Preset) => void;
}) {
  return (
    <fieldset className="tiles">
      <legend className="sr-only">Plan shape</legend>
      {PRESETS.map((p) => (
        <label key={p.id} className="tile">
          <input
            type="radio"
            name="preset"
            className="sr-only"
            value={p.id}
            checked={selected === p.id}
            onChange={() => onSelect(p)}
          />
          <span className="tile-name">{p.name}</span>
          <span className="tile-shape">{planSentence(p.plan)}</span>
        </label>
      ))}
    </fieldset>
  );
}
