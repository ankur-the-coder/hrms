// Deprecated legacy route — removed in the enterprise rewrite. See GUIDELINES.md.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(410).json({ error: 'This legacy endpoint was removed in the v2 rewrite.' });
}
