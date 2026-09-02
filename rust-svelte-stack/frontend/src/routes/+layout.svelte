<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { session, hydrateSession } from '$lib/stores/session';
  import { theme } from '$lib/stores/theme';
  import { initTooltips } from '$lib/tooltip';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Topbar from '$lib/components/Topbar.svelte';

  let { children } = $props();
  let mobileNav = $state(false);
  let booted = $state(false);

  const isLogin = $derived(page.url.pathname === '/login');

  onMount(async () => {
    initTooltips();
    await hydrateSession();
    booted = true;
  });

  // auth guard
  $effect(() => {
    if (!booted) return;
    if (!$session.token && !isLogin) goto('/login');
    if ($session.token && isLogin) goto('/home');
  });

  // wallpaper css from theme store
  const WALLPAPERS: Record<string, string> = {
    'emerald-mist': 'radial-gradient(ellipse at 20% 15%, rgba(13,122,84,0.35), transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(217,249,106,0.28), transparent 50%), linear-gradient(160deg, #eef3ec, #dce8df)',
    dawn: 'linear-gradient(150deg, #ffdfc4 0%, #ffb8a0 30%, #b8a0d8 70%, #7a8ec9 100%)',
    graphite: 'repeating-linear-gradient(45deg, #23282c 0 14px, #272d31 14px 28px)',
    sakura: 'radial-gradient(circle at 25% 20%, rgba(255,150,190,0.4), transparent 45%), linear-gradient(160deg, #fff0f5, #ffe4ef)',
    aurora: 'linear-gradient(200deg, #071a14 10%, #0b3b2d 40%, #14755b 65%, #58c1a0 100%)',
  };
  const wallpaperCss = $derived(
    $theme.wallpaper.startsWith('url:') ? `url("${$theme.wallpaper.slice(4)}")` : WALLPAPERS[$theme.wallpaper] || ''
  );
</script>

{#if isLogin}
  {@render children()}
{:else if booted}
  {#if wallpaperCss}
    <div class="wallpaper" style="background:{wallpaperCss};background-size:cover"></div>
  {/if}
  <div class="shell">
    <div class="side desktop"><Sidebar /></div>
    {#if mobileNav}
      <div class="scrim" role="presentation" onclick={() => (mobileNav = false)}></div>
      <div class="side mobile tk-pop"><Sidebar onNavigate={() => (mobileNav = false)} /></div>
    {/if}
    <div class="main">
      <div class="topwrap"><Topbar onMenu={() => (mobileNav = true)} /></div>
      <main>{@render children()}</main>
    </div>
  </div>
{/if}

<style>
  .wallpaper { position: fixed; inset: 0; z-index: -1; }
  .wallpaper::after { content: ''; position: absolute; inset: 0;
    background: color-mix(in srgb, var(--t-bg) 72%, transparent); }
  .shell { display: flex; min-height: 100vh; }
  .side.desktop { position: fixed; inset: 0 auto 0 0; width: 240px; z-index: 40;
    border-right: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent);
    background: color-mix(in srgb, var(--t-surface) 85%, transparent); backdrop-filter: blur(8px); }
  .side.mobile { position: fixed; inset: 0 auto 0 0; width: 240px; z-index: 60;
    background: var(--t-surface); border-radius: 0 !important; }
  .scrim { position: fixed; inset: 0; z-index: 55; background: rgba(0,0,0,0.4); }
  .main { flex: 1; min-width: 0; margin-left: 240px; }
  .topwrap { position: sticky; top: 0; z-index: 30;
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent);
    background: color-mix(in srgb, var(--t-bg) 80%, transparent); backdrop-filter: blur(8px); }
  main { padding: 24px; max-width: 1120px; margin: 0 auto; }
  @media (max-width: 1023px) {
    .side.desktop { display: none; }
    .main { margin-left: 0; }
  }
</style>
