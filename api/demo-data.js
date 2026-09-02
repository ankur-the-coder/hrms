import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('hrms_demo_people').select('*').order('id', { ascending: true }).limit(500);
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'PUT') {
      const { ids, patch } = req.body;
      if (!Array.isArray(ids) || !ids.length || !patch) return res.status(400).json({ error: 'ids and patch required' });
      const allowed = {};
      if (patch.status) allowed.status = patch.status;
      if (patch.dept) allowed.dept = patch.dept;
      const { data, error } = await supabase
        .from('hrms_demo_people').update(allowed).in('id', ids).select();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { ids } = req.body;
      if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
      const { error } = await supabase.from('hrms_demo_people').delete().in('id', ids);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('demo-data API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
