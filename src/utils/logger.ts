const ts = () => {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** ANSI color helpers */
export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

const BAR_WIDTH = 20;

function progressBar(done: number, total: number): string {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const filled = Math.round(pct * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return "[" + "=".repeat(filled) + "-".repeat(empty) + "]";
}

function pctStr(done: number, total: number): string {
  if (total === 0) return "0%";
  return Math.round((done / total) * 100) + "%";
}

export const log = {
  ansi,

  init(total: number) {
    // no-op
  },

  /** Extremely minimal step header */
  step(n: number, total: number, msg: string) {
    console.log(`${ansi.cyan}${ansi.bold}[${n}/${total}] ${msg}${ansi.reset}`);
  },

  /** Throttled progress log */
  progress(done: number, total: number, label = "") {
    const interval = Math.max(1, Math.floor(total / 5));
    if (done % interval === 0 || done === total) {
      const bar = progressBar(done, total);
      const pct = pctStr(done, total);
      const lbl = label ? ` (${label})` : "";
      console.log(`${ansi.gray}  Progress: ${bar} ${pct} - ${done}/${total}${lbl}${ansi.reset}`);
    }
  },

  info(msg: string) {
    console.log(`${ansi.gray}  i ${ansi.reset}${msg}`);
  },

  ok(msg: string) {
    console.log(`${ansi.green}  + ${msg}${ansi.reset}`);
  },

  warn(msg: string) {
    console.log(`${ansi.yellow}  ! ${msg}${ansi.reset}`);
  },

  error(msg: string, err?: unknown) {
    console.error(`${ansi.red}  x ERROR: ${msg}${ansi.reset}`);
    if (err instanceof Error) console.error(`${ansi.gray}    ${err.message}${ansi.reset}`);
  },

  /** Minimal done message */
  done(msg: string) {
    console.log(`${ansi.green}${ansi.bold}DONE: ${msg}${ansi.reset}`);
  },

  divider() {
    // skip divider for ultra-minimal look
  },

  raw(msg: string) {
    console.log(msg);
  },
};
