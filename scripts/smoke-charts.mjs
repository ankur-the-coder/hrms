// Runtime smoke test: paints every chart kind (2D + 3D, single + multi)
// against a mock canvas ctx; fails if a painter throws OR produces no
// fill/stroke draw calls (the "renders in export but not live" class of bug).
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmp = mkdtempSync(join(tmpdir(), 'chart-smoke-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `
import { paintChart } from '${process.cwd()}/src/shared/Charts.tsx';

function mockCtx() {
  const calls = { fill: 0, stroke: 0, fillRect: 0, fillText: 0 };
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === '__calls') return calls;
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop in calls) return () => { (calls as any)[prop]++; };
      return () => {};
    },
    set() { return true; },
  });
  return ctx as any;
}

const data = [
  { label: 'Engineering Team', value: 240 },
  { label: 'Sales & Partnerships', value: 30 },
  { label: 'HR', value: 18 },
  { label: 'Finance Operations', value: 9 },
];
const cats = ['Q1', 'Q2', 'Q3', 'Q4'];
const series = [
  { name: 'Female', values: [10, 14, 12, 16] },
  { name: 'Male', values: [12, 11, 15, 13] },
];
const colors = ['#0d7a54', '#c9932b', '#0ea5e9', '#a855f7'];
const sColors = ['#0d7a54', '#c9932b'];
const t = { ink: '#111', axis: '#333', grid: 'rgba(0,0,0,0.1)' };
const hov = { idx: null, seg: null, amt: 0 };

const kinds = ['bar', 'line', 'area', 'pie', 'donut', 'radar', 'polar', 'funnel', 'pyramid'] as const;
let failures = 0;

for (const kind of kinds) {
  for (const m of [0, 1]) {
    for (const multi of [false, true]) {
      if (multi && ['pie', 'donut', 'polar', 'funnel', 'pyramid'].includes(kind)) continue;
      for (const p of [0.5, 1]) {
        const ctx = mockCtx();
        const label = \`\${kind} m=\${m} multi=\${multi} p=\${p}\`;
        try {
          paintChart(ctx, kind as any, {
            W: 600, H: 300, t, p, m, hov,
            data, colors, multi, cats: multi ? cats : [], series: multi ? series : [], sColors,
            yLabel: 'Employees',
          });
          const c = ctx.__calls;
          const drew = c.fill + c.stroke + c.fillRect > 0;
          if (!drew) { console.error('NO-DRAW  ', label, JSON.stringify(c)); failures++; }
          else console.log('ok       ', label, \`fill=\${c.fill} stroke=\${c.stroke} rect=\${c.fillRect} text=\${c.fillText}\`);
        } catch (e) {
          console.error('THROW    ', label, '→', (e as Error).message);
          failures++;
        }
      }
    }
  }
}
if (failures) { console.error(\`\\n\${failures} FAILURES\`); process.exit(1); }
console.log('\\nALL PAINTERS OK');
`);

// bundle with the working esbuild binary, run in node
const out = join(tmp, 'bundle.mjs');
const r = spawnSync(process.cwd() + '/.esbuild-fix/@esbuild/linux-x64/bin/esbuild', [
  entry, '--bundle', '--format=esm', '--platform=node', '--jsx=automatic',
  '--loader:.tsx=tsx', '--loader:.ts=ts', `--outfile=${out}`,
  '--external:react', '--external:react-dom', '--external:lucide-react', '--external:framer-motion',
], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }

const run = spawnSync('node', [out], { encoding: 'utf8', cwd: process.cwd() });
console.log(run.stdout);
if (run.stderr) console.error(run.stderr);
process.exit(run.status ?? 1);
