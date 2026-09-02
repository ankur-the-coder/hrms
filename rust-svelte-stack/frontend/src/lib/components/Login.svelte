<script lang="ts">
  // Mirror of React src/pages/Login.tsx — luxury auth card with the full
  // flap-sweep transition: the forest overlay expands via clip-path to cover
  // the card, form/mode/side swap at midpoint, flap retracts to the opposite
  // angled rest, incoming content staggers upward (sweep 680ms,
  // cubic-bezier(.83,0,.17,1); stagger delays 50–540ms).
  let mode: 'in' | 'up' = $state('in');
  let side: 'right' | 'left' = $state('right');
  let covering = $state(false);
  let phase: 'in' | 'out' | 'pre' = $state('in');
  let animating = false;

  function toggleFlap() {
    if (animating) return;
    animating = true;
    phase = 'out';
    covering = true;
    setTimeout(() => {
      mode = mode === 'in' ? 'up' : 'in';
      side = side === 'right' ? 'left' : 'right';
      phase = 'pre';
      covering = false;
      requestAnimationFrame(() => requestAnimationFrame(() => (phase = 'in')));
    }, 680);
    setTimeout(() => (animating = false), 1360);
  }
  let email = $state('');
  let password = $state('');
  let fullName = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (password.length < 6) { error = 'Password must be at least 6 characters.'; return; }
    busy = true;
    try {
      const res = await fetch(`/api/v1/auth/${mode === 'in' ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Authentication failed');
      localStorage.setItem('aviary-jwt', json.token);
      location.href = '/home';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Authentication failed';
    } finally { busy = false; }
  }
</script>

<div class="page">
  <div class="card">
    <aside class="brand">
      <p class="masthead">Aviary <i class="dot"></i> People OS</p>
      <div>
        <p class="eyebrow">Est. 2019 · Bengaluru</p>
        <h2>The quiet luxury of<br /><em>effortless HR.</em></h2>
        <p class="sub">Attendance, payroll, people and structure — one serene workspace for 1,000+ organizations.</p>
      </div>
      <p class="foot">— Members only —</p>
    </aside>

    <section class="form">
      <p class="eyebrow gold">{mode === 'in' ? 'Member access' : 'New membership'}</p>
      <h1>{mode === 'in' ? 'Welcome' : 'Join the'} <em>{mode === 'in' ? 'back.' : 'house.'}</em></h1>

      <form onsubmit={submit}>
        {#if mode === 'up'}
          <label><span>Full name</span><input type="text" bind:value={fullName} placeholder="Asha Verma" required /></label>
        {/if}
        <label><span>Email address</span><input type="email" bind:value={email} placeholder="you@company.com" required /></label>
        <label><span>Password</span><input type="password" bind:value={password} placeholder="••••••••••" required /></label>
        {#if error}<p class="err">{error}</p>{/if}
        <button class="cta" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Enter workspace' : 'Create account'} →</button>
      </form>

      <p class="switch">
        {mode === 'in' ? 'New to Aviary?' : 'Already a member?'}
        <button onclick={() => { error = ''; toggleFlap(); }}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </section>
  </div>
</div>

<style>
  :global(:root) { --lux-cream: #f5efe3; --lux-card: #fbf7ef; --lux-gold: #c6a15b;
    --lux-gold-soft: #e2cd9c; --lux-ink: #1f2a20; --lux-muted: #6f7a68;
    --lux-line: rgba(31,42,32,0.16); --lux-f7: #223a2a; --lux-f8: #16261c; --lux-f9: #101d15; }
  .page { min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: radial-gradient(ellipse at 20% 10%, rgba(198,161,91,0.16), transparent 55%), var(--lux-cream); }
  .card { display: grid; grid-template-columns: 1.05fr 1fr; width: min(880px, 100%);
    border-radius: 26px; overflow: hidden; background: var(--lux-card);
    box-shadow: 0 32px 80px rgba(31,42,32,0.22); animation: rise 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(24px) scale(0.985); } }
  .brand { display: flex; flex-direction: column; justify-content: space-between; padding: 40px;
    background: linear-gradient(160deg, var(--lux-f7), var(--lux-f8) 55%, var(--lux-f9));
    box-shadow: inset 0 0 0 1px rgba(226,205,156,0.07); }
  .masthead { font: 700 11px 'Outfit', sans-serif; letter-spacing: 0.3em; text-transform: uppercase; color: var(--lux-gold-soft); }
  .dot { display: inline-block; width: 4px; height: 4px; border-radius: 999px; background: var(--lux-gold); margin: 0 6px 2px; }
  .brand h2 { font: 500 36px/1.14 'Fraunces', serif; color: #fff; }
  .brand h2 em { color: var(--lux-gold-soft); }
  .brand .sub { margin-top: 14px; max-width: 340px; font: 400 13.5px/1.6 'Outfit', sans-serif; color: rgba(255,255,255,0.55); }
  .eyebrow { font: 700 10.5px 'Outfit', sans-serif; letter-spacing: 0.28em; text-transform: uppercase; color: var(--lux-gold); margin-bottom: 10px; }
  .foot { font: 500 10px 'Outfit', sans-serif; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(255,255,255,0.35); text-align: center; }
  .form { padding: 40px; }
  .form h1 { font: 500 30px 'Fraunces', serif; color: var(--lux-ink); }
  .form h1 em { color: var(--lux-gold); }
  form { margin-top: 26px; display: flex; flex-direction: column; gap: 20px; }
  label span { display: block; font: 700 10.5px 'Outfit', sans-serif; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--lux-muted); margin-bottom: 6px; }
  input { width: 100%; background: transparent; border: 0; border-bottom: 1px solid var(--lux-line);
    padding: 6px 0 8px; font: 500 14.5px 'Outfit', sans-serif; color: var(--lux-ink); outline: none; }
  input:focus { border-bottom: 2px solid var(--lux-gold); }
  .cta { border-radius: 999px; padding: 14px; font: 700 13px 'Outfit', sans-serif;
    letter-spacing: 0.18em; text-transform: uppercase; color: #fff;
    background: linear-gradient(135deg, var(--lux-gold), #a9853f);
    box-shadow: 0 10px 26px rgba(198,161,91,0.4); }
  .cta:active { transform: scale(0.98); }
  .err { font: 600 12.5px 'Outfit', sans-serif; color: #b32222; background: rgba(214,48,48,0.08);
    border-radius: 12px; padding: 9px 14px; }
  .switch { margin-top: 20px; text-align: center; font: 500 12.5px 'Outfit', sans-serif; color: var(--lux-muted); }
  .switch button { color: var(--lux-gold); font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
  /* ---- flap sweep (mirrors React .lx-* classes) ---- */
  :global(.lx-flap) { position: absolute; inset: 0; z-index: 10;
    background: radial-gradient(900px 500px at 20% 0%, rgba(198,161,91,0.14), transparent 55%),
      linear-gradient(155deg, #223a2a 0%, #16261c 55%, #101d15 100%);
    transition: clip-path 0.68s cubic-bezier(0.83, 0, 0.17, 1); will-change: clip-path; }
  :global(.lx-flap.rest-right) { clip-path: polygon(46% 0%, 100% 0%, 100% 100%, 60% 100%); }
  :global(.lx-flap.rest-left) { clip-path: polygon(0% 0%, 54% 0%, 40% 100%, 0% 100%); }
  :global(.lx-flap.covering) { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%) !important; }
  :global(.lx-stagger) { opacity: 0; transform: translateY(22px); transition: none; }
  :global(.lx-in .lx-stagger) { opacity: 1; transform: translateY(0);
    transition: opacity 0.5s cubic-bezier(0.22,1,0.36,1), transform 0.5s cubic-bezier(0.22,1,0.36,1); }
  :global(.lx-in .lx-stagger:nth-child(1)) { transition-delay: 0.05s; }
  :global(.lx-in .lx-stagger:nth-child(2)) { transition-delay: 0.12s; }
  :global(.lx-in .lx-stagger:nth-child(3)) { transition-delay: 0.19s; }
  :global(.lx-in .lx-stagger:nth-child(4)) { transition-delay: 0.26s; }
  :global(.lx-out .lx-stagger) { opacity: 0; transform: translateY(-14px);
    transition: opacity 0.26s ease, transform 0.26s ease; }
  @media (max-width: 860px) { .card { grid-template-columns: 1fr; } .brand { display: none; } }
</style>
