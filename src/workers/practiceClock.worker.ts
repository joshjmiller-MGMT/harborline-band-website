// Practice clock worker — drives the metronome scheduler wakeups and the
// session-timer ticks from a dedicated worker thread. Browsers throttle
// main-thread setInterval/setTimeout hard when a tab is backgrounded (to 1s or
// worse), which made the metronome stutter/stop and the timer fall behind when
// the phone locked or the user switched apps. Worker timers are not subject to
// tab-visibility throttling, so ticks keep flowing; the main thread does the
// actual WebAudio scheduling / elapsed math when each tick arrives.
//
// Protocol (messages in): { type: "metro-start" | "metro-stop" | "clock-start" | "clock-stop" }
// Messages out:           { type: "metro-tick" | "clock-tick" }

const post = (type: string) =>
  (self as unknown as { postMessage: (d: unknown) => void }).postMessage({ type });

let metroTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent) => {
  const type = (e.data as { type?: string } | null)?.type;
  switch (type) {
    case "metro-start":
      if (metroTimer == null) metroTimer = setInterval(() => post("metro-tick"), 25);
      break;
    case "metro-stop":
      if (metroTimer != null) clearInterval(metroTimer);
      metroTimer = null;
      break;
    case "clock-start":
      if (clockTimer == null) clockTimer = setInterval(() => post("clock-tick"), 250);
      break;
    case "clock-stop":
      if (clockTimer != null) clearInterval(clockTimer);
      clockTimer = null;
      break;
  }
};
