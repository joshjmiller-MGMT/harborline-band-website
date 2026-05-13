import { useCallback, useEffect, useRef, useState } from "react";

// Drag-to-rotate BPM wheel. Pointer events handle mouse + touch uniformly.
// Sensitivity: 360° rotation ≈ 60 BPM (sweep 40 → 220 in ~3 rotations).
const BPM_MIN = 30;
const BPM_MAX = 300;
const BPM_PER_ROTATION = 60;
const DEG_PER_BPM = 360 / BPM_PER_ROTATION;

interface Props {
  bpm: number;
  onBpmChange: (next: number) => void;
  running: boolean;
  currentBeat: number; // -1 idle, 0..3
  size?: number; // px, default 220
  accent?: boolean; // for fine-step buttons; default true
}

function angleAtPointer(x: number, y: number, cx: number, cy: number): number {
  // Standard math angle (0 = east, ccw positive); convert to clockwise from top so
  // dragging right increments bpm.
  const dx = x - cx;
  const dy = y - cy;
  const rad = Math.atan2(dy, dx);
  return (rad * 180) / Math.PI; // -180..180
}

export default function MetronomeWheel({
  bpm,
  onBpmChange,
  running,
  currentBeat,
  size = 220,
  accent = true,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  // We carry signed angular accumulation so the BPM responds to the *delta* of
  // pointer rotation, not absolute angle position — that way a slow continuous
  // drag updates BPM smoothly instead of jumping when the pointer wraps.
  const lastAngleRef = useRef<number | null>(null);
  const accumDegRef = useRef(0); // accumulated unwrapped degrees since drag-start
  const bpmAtDragStartRef = useRef(bpm);

  const clamp = (n: number) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)));

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const a = angleAtPointer(e.clientX, e.clientY, cx, cy);
      lastAngleRef.current = a;
      accumDegRef.current = 0;
      bpmAtDragStartRef.current = bpm;
      setDragging(true);
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* fine if not supported */
      }
    },
    [bpm]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !ref.current || lastAngleRef.current === null) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const a = angleAtPointer(e.clientX, e.clientY, cx, cy);
      // Compute shortest-arc delta from last angle, accumulate (lets the user
      // wind past wrap points without the bpm jumping).
      let delta = a - lastAngleRef.current;
      if (delta > 180) delta -= 360;
      else if (delta < -180) delta += 360;
      accumDegRef.current += delta;
      lastAngleRef.current = a;
      const bpmDelta = accumDegRef.current / DEG_PER_BPM;
      onBpmChange(clamp(bpmAtDragStartRef.current + bpmDelta));
    },
    [dragging, onBpmChange]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    lastAngleRef.current = null;
    accumDegRef.current = 0;
  }, []);

  // Wheel scroll: fine-tune ±1 BPM per notch
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      onBpmChange(clamp(bpm + dir));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [bpm, onBpmChange]);

  // Visual tick marks every 5 BPM increment around the dial
  const ticks = [];
  for (let t = 0; t < 60; t++) {
    const isMajor = t % 5 === 0;
    const angle = (t / 60) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const outerR = size / 2 - 6;
    const innerR = outerR - (isMajor ? 10 : 5);
    const x1 = size / 2 + Math.cos(rad) * innerR;
    const y1 = size / 2 + Math.sin(rad) * innerR;
    const x2 = size / 2 + Math.cos(rad) * outerR;
    const y2 = size / 2 + Math.sin(rad) * outerR;
    ticks.push(
      <line
        key={t}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeWidth={isMajor ? 1.5 : 0.75}
        className={isMajor ? "text-foreground/40" : "text-foreground/20"}
      />
    );
  }

  // Rotating pointer indicator — angle proportional to bpm within full range
  const pointerAngle = ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 320 - 160; // visual span ~320° to leave a gap
  const cx = size / 2;
  const cy = size / 2;
  const pointerLen = size / 2 - 18;
  const pointerRad = ((pointerAngle - 90) * Math.PI) / 180;
  const px = cx + Math.cos(pointerRad) * pointerLen;
  const py = cy + Math.sin(pointerRad) * pointerLen;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative touch-none cursor-grab ${dragging ? "cursor-grabbing" : ""}`}
        style={{ width: size, height: size }}
        role="slider"
        aria-label="Metronome BPM"
        aria-valuemin={BPM_MIN}
        aria-valuemax={BPM_MAX}
        aria-valuenow={bpm}
      >
        <svg width={size} height={size} className="absolute inset-0">
          {/* outer ring */}
          <circle
            cx={cx}
            cy={cy}
            r={size / 2 - 4}
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth={2}
          />
          {ticks}
          {/* pointer */}
          <line
            x1={cx}
            y1={cy}
            x2={px}
            y2={py}
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            strokeLinecap="round"
            className="transition-all duration-150"
          />
          <circle cx={cx} cy={cy} r={6} fill="hsl(var(--primary))" />
          {/* beat indicator dots around the rim */}
          {[0, 1, 2, 3].map((b) => {
            const a = (b / 4) * 2 * Math.PI - Math.PI / 2;
            const r = size / 2 - 22;
            const bx = cx + Math.cos(a) * r;
            const by = cy + Math.sin(a) * r;
            const active = currentBeat === b && running;
            return (
              <circle
                key={b}
                cx={bx}
                cy={by}
                r={active ? 6 : 3}
                fill={b === 0 ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                opacity={active ? 1 : 0.25}
                className="transition-all"
              />
            );
          })}
        </svg>
        {/* Center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-4xl font-bold tabular-nums">{bpm}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">bpm</span>
        </div>
      </div>
      {accent && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onBpmChange(clamp(bpm - 5))}
            className="h-7 w-9 rounded border text-xs hover:bg-muted"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => onBpmChange(clamp(bpm - 1))}
            className="h-7 w-9 rounded border text-xs hover:bg-muted"
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => onBpmChange(clamp(bpm + 1))}
            className="h-7 w-9 rounded border text-xs hover:bg-muted"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => onBpmChange(clamp(bpm + 5))}
            className="h-7 w-9 rounded border text-xs hover:bg-muted"
          >
            +5
          </button>
        </div>
      )}
    </div>
  );
}
