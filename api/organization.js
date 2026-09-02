import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { resource, from, to, category, actor, sub_category, attribute, event } = req.query;

      if (resource === 'people') {
        const { data, error } = await supabase
          .from('hrms_people').select('*').order('id', { ascending: true }).limit(600);
        if (error) throw error;
        return res.status(200).json(data);
      }

      if (resource === 'audit') {
        let q = supabase.from('hrms_audit_events').select('*').order('created_at', { ascending: false }).limit(400);
        if (from) q = q.gte('created_at', `${from}T00:00:00Z`);
        if (to) q = q.lte('created_at', `${to}T23:59:59Z`);
        if (category && category !== 'All') q = q.eq('category', category);
        if (actor) q = q.eq('actor', actor);
        if (sub_category) q = q.eq('sub_category', sub_category);
        if (attribute) q = q.eq('attribute', attribute);
        if (event) q = q.eq('event', event);
        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json(data);
      }

      if (resource === 'logins') {
        const since = new Date(Date.now() - 30 * 864e5).toISOString();
        const { data, error } = await supabase
          .from('hrms_audit_events').select('created_at')
          .eq('category', 'Auth').eq('event', 'Login').gte('created_at', since);
        if (error) throw error;
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'unknown resource' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('organization API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
