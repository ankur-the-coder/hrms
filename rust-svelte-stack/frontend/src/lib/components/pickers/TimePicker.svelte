<script lang="ts">
  // Mirror of React src/shared/pickers/TimePicker.tsx — Clock Dial / iOS
  // Wheel / Sliders with device-aware default (clock on desktop, wheel on touch).
  let { value = $bindable('09:30'), placeholder = 'Pick a time' } = $props();

  type TMode = 'clock' | 'wheel' | 'slider';
  const isTouch = () => matchMedia('(pointer: coarse)').matches || innerWidth < 640;
  let mode: TMode = $state((localStorage.getItem('aviary-timepicker-mode') as TMode) || (isTouch() ? 'wheel' : 'clock'));
  let open = $state(false);
  let phase: 'hour' | 'minute' = $state('hour');

  const parsed = $derived.by(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value) || ['', '9', '30'];
    const h24 = +m[1], min = +m[2];
    return { h24, min, h12: h24 % 12 === 0 ? 12 : h24 % 12, pm: h24 >= 12 };
  });

  function setH(h12: number) {
    const h24 = parsed.pm ? (h12 % 12) + 12 : h12 % 12;
    value = `${String(h24).padStart(2, '0')}:${String(parsed.min).padStart(2, '0')}`;
  }
  function setM(min: number) {
    value = `${String(parsed.h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  function setPm(pm: boolean) {
    const h24 = pm ? (parsed.h12 % 12) + 12 : parsed.h12 % 12;
    value = `${String(h24).padStart(2, '0')}:${String(parsed.min).padStart(2, '0')}`;
  }
  function pickMode(m: TMode) { mode = m; localStorage.setItem('aviary-timepicker-mode', m); }
</script>

<div class="root">
  <button class="tk-input field" onclick={() => (open = !open)}>
    {parsed.h12}:{String(parsed.min).padStart(2, '0')} {parsed.pm ? 'PM' : 'AM'} <span>⏱</span>
  </button>
  {#if open}
    <div class="tk-pop panel">
      <div class="tk-inset seg">
        {#each ['clock', 'wheel', 'slider'] as m}
          <button class:active={mode === m} onclick={() => pickMode(m as TMode)}>{m}</button>
        {/each}
      </div>

      {#if mode === 'clock'}
        <div class="tk-inset seg small">
          <button class:active={phase === 'hour'} onclick={() => (phase = 'hour')}>Hours</button>
          <button class:active={phase === 'minute'} onclick={() => (phase = 'minute')}>Minutes</button>
        </div>
        <div class="dial tk-raise-sm">
          {#each Array(12) as _, i}
            {@const n = phase === 'hour' ? i + 1 : i * 5}
            {@const a = ((phase === 'hour' ? (i + 1) * 30 : i * 30) - 90) * Math.PI / 180}
            <button class="num" class:on={phase === 'hour' ? parsed.h12 === n : parsed.min === n}
              style="left:{50 + Math.cos(a) * 38}%; top:{50 + Math.sin(a) * 38}%"
              onclick={() => phase === 'hour' ? (setH(n), (phase = 'minute')) : setM(n)}>
              {phase === 'hour' ? n : String(n).padStart(2, '0')}
            </button>
          {/each}
        </div>
      {:else if mode === 'wheel'}
        <div class="wheels tk-inset">
          <select size="5" onchange={(e) => setH(+(e.target as HTMLSelectElement).value)}>
            {#each Array(12) as _, i}<option value={i + 1} selected={parsed.h12 === i + 1}>{String(i + 1).padStart(2, '0')}</option>{/each}
          </select>
          <select size="5" onchange={(e) => setM(+(e.target as HTMLSelectElement).value)}>
            {#each Array(60) as _, i}<option value={i} selected={parsed.min === i}>{String(i).padStart(2, '0')}</option>{/each}
          </select>
          <select size="2" onchange={(e) => setPm((e.target as HTMLSelectElement).value === 'PM')}>
            <option selected={!parsed.pm}>AM</option><option selected={parsed.pm}>PM</option>
          </select>
        </div>
      {:else}
        <label>Hours <b>{parsed.h12}</b>
          <input class="tk-range" type="range" min="1" max="12" value={parsed.h12} oninput={(e) => setH(+(e.target as HTMLInputElement).value)} /></label>
        <label>Minutes <b>{String(parsed.min).padStart(2, '0')}</b>
          <input class="tk-range" type="range" min="0" max="59" value={parsed.min} oninput={(e) => setM(+(e.target as HTMLInputElement).value)} /></label>
      {/if}

      <div class="ampm">
        <button class:on={!parsed.pm} onclick={() => setPm(false)}>AM</button>
        <button class:on={parsed.pm} onclick={() => setPm(true)}>PM</button>
        <button class="tk-btn-primary done" onclick={() => (open = false)}>Done</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .root { position: relative; }
  .field { display: flex; justify-content: space-between; width: 100%; padding: 9px 14px;
    font: 500 14px var(--t-font-body); color: var(--t-ink); }
  .panel { position: absolute; top: calc(100% + 6px); width: 280px; padding: 12px; z-index: 60; }
  .seg { display: flex; gap: 2px; padding: 4px; border-radius: 12px; margin-bottom: 10px; }
  .seg.small { width: fit-content; margin-inline: auto; }
  .seg button { flex: 1; padding: 6px 10px; border-radius: 8px; font: 700 11.5px var(--t-font-body);
    text-transform: capitalize; color: var(--t-muted); }
  .seg button.active { background: var(--t-surface); box-shadow: var(--t-shadow-card); color: var(--t-accent); }
  .dial { position: relative; width: 200px; height: 200px; margin: 8px auto; border-radius: 999px; }
  .num { position: absolute; transform: translate(-50%, -50%); width: 32px; height: 32px;
    border-radius: 999px; font: 600 12.5px var(--t-font-body); color: var(--t-ink); }
  .num.on { background: var(--t-accent); color: #fff; font-weight: 700; }
  .wheels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px; }
  .wheels select { background: transparent; border: 0; font: 600 14px var(--t-font-body);
    color: var(--t-ink); text-align: center; outline: none; }
  label { display: block; font: 600 12.5px var(--t-font-body); color: var(--t-muted); margin-bottom: 12px; }
  label b { float: right; color: var(--t-accent); }
  label input { width: 100%; margin-top: 6px; }
  .ampm { display: flex; gap: 6px; margin-top: 10px; align-items: center; }
  .ampm button { padding: 6px 12px; border-radius: 999px; font: 700 11.5px var(--t-font-body); color: var(--t-muted); }
  .ampm button.on { background: var(--t-accent); color: #fff; }
  .done { margin-left: auto; padding: 7px 18px; font: 700 12.5px var(--t-font-body); border-radius: 999px; }
</style>
