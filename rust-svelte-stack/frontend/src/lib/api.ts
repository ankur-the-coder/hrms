import { get } from 'svelte/store';
import { session } from './stores/session';

export async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const s = get(session);
  const res = await fetch(`/api/v1/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(s.token ? { Authorization: `Bearer ${s.token}` } : {}),
      ...(opts?.headers || {}),
    },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`);
  return json as T;
}

export const fmtDate = (d?: string | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!d) return '—';
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' });
};
export const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* CDN loaders — pdfMake & ExcelJS for DataTable exports */
const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scriptCache.has(src)) {
    scriptCache.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { scriptCache.delete(src); reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return scriptCache.get(src)!;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPdfMake(): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/vfs_fonts.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).pdfMake;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadExcelJS(): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).ExcelJS;
}

/** Print an HTML document via a hidden off-screen iframe (popup-safe). */
export function printHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:200vw;bottom:200vh;width:1080px;height:760px;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow!.document;
  doc.open(); doc.write(html); doc.close();
  const cleanup = () => { try { iframe.remove(); } catch { /* noop */ } };
  iframe.contentWindow!.onafterprint = cleanup;
  setTimeout(() => {
    try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch { cleanup(); }
    setTimeout(cleanup, 60000);
  }, 350);
}
