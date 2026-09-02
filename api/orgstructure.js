import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const TABLES = {
  legal_entities: 'hrms_legal_entities',
  business_units: 'hrms_business_units',
  locations: 'hrms_locations',
  departments: 'hrms_departments',
  cost_centers: 'hrms_cost_centers',
  pay_grades: 'hrms_pay_grades',
  bands: 'hrms_bands',
};

// people columns that group assignments write into
const ASSIGN_FIELDS = new Set(['business_unit', 'location', 'dept', 'cost_center', 'legal_entity']);

/** Normalize spreadsheet share links into direct CSV endpoints. */
function normalizeLink(url) {
  // Google Sheets: /spreadsheets/d/<id>/... -> export?format=csv (respect gid if present)
  const gs = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (gs) {
    const gid = url.match(/[#&?]gid=(\d+)/);
    return `https://docs.google.com/spreadsheets/d/${gs[1]}/export?format=csv${gid ? `&gid=${gid[1]}` : ''}`;
  }
  // OneDrive / Outlook share links: use download redirect
  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/.test(url)) {
    return url.includes('download=1') ? url : url + (url.includes('?') ? '&' : '?') + 'download=1';
  }
  return url;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const out = {};
      for (const [key, table] of Object.entries(TABLES)) {
        const { data, error } = await supabase.from(table).select('*').order('id');
        if (error) throw error;
        out[key] = data;
      }
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      const { resource, action, data, id } = req.body;

      /* ---- server-side link fetch (avoids CORS; supports GSheets/OneDrive/any CSV URL) ---- */
      if (resource === 'fetch_link') {
        const { url } = req.body;
        if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'A valid http(s) link is required' });
        const target = normalizeLink(url.trim());
        const r = await fetch(target, { redirect: 'follow', headers: { 'User-Agent': 'AviaryHRMS/2.0' } });
        if (!r.ok) return res.status(400).json({ error: `Link fetch failed (${r.status}). Make sure the link is publicly accessible.` });
        const text = await r.text();
        if (text.length > 2_000_000) return res.status(400).json({ error: 'File too large (max 2 MB)' });
        if (/^\s*</.test(text)) return res.status(400).json({ error: 'Link returned a web page, not CSV. For Google Sheets use “Anyone with the link”, for OneDrive use a direct download link.' });
        return res.status(200).json({ csv: text });
      }

      /* ---- bulk assign employees to a group ---- */
      if (resource === 'bulk_assign') {
        const { field, value, emails } = req.body;
        if (!ASSIGN_FIELDS.has(field)) return res.status(400).json({ error: 'invalid assignment field' });
        if (!value || !Array.isArray(emails) || !emails.length) return res.status(400).json({ error: 'value and emails required' });
        const norm = emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean).slice(0, 500);
        const { data: matched, error: mErr } = await supabase
          .from('hrms_people').select('id, email').in('email', norm);
        if (mErr) throw mErr;
        if (matched.length) {
          const { error } = await supabase
            .from('hrms_people').update({ [field]: value }).in('id', matched.map((m) => m.id));
          if (error) throw error;
        }
        await supabase.from('hrms_audit_events').insert({
          actor: 'Admin', category: 'Org', sub_category: 'Structure', attribute: field,
          event: 'Bulk Assign', detail: `${matched.length} employees assigned to ${value}`,
        });
        return res.status(200).json({ assigned: matched.length, missed: norm.length - matched.length });
      }

      /* ---- generic CRUD ---- */
      const table = TABLES[resource];
      if (!table) return res.status(400).json({ error: 'unknown resource' });

      if (action === 'create') {
        const { data: row, error } = await supabase.from(table).insert(data).select().single();
        if (error) throw error;
        await supabase.from('hrms_audit_events').insert({
          actor: 'Admin', category: 'Org', sub_category: 'Structure', attribute: resource,
          event: 'Created', detail: `${resource.replace('_', ' ')} "${data.name || ''}" created`,
        });
        return res.status(201).json(row);
      }
      if (action === 'update') {
        const { data: row, error } = await supabase.from(table).update(data).eq('id', id).select().single();
        if (error) throw error;
        return res.status(200).json(row);
      }
      if (action === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (action === 'bulk_create' && Array.isArray(data)) {
        const { data: rows, error } = await supabase.from(table).insert(data.slice(0, 200)).select();
        if (error) throw error;
        return res.status(201).json(rows);
      }
      return res.status(400).json({ error: 'unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('orgstructure API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
