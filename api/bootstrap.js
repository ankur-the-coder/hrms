import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { email, name, avatar, auth_id } = req.query;
      if (!email) return res.status(400).json({ error: 'email required' });

      const norm = String(email).trim().toLowerCase();
      const { data: existing, error: exErr } = await supabase
        .from('hrms_users').select('*').eq('email', norm).maybeSingle();
      if (exErr) throw exErr;
      if (existing) {
        if (auth_id && !existing.auth_id) {
          await supabase.from('hrms_users').update({ auth_id }).eq('id', existing.id);
        }
        return res.status(200).json(existing);
      }

      // get-or-create default tenant
      let { data: tenant } = await supabase.from('hrms_tenants').select('*').eq('slug', 'aviary').maybeSingle();
      if (!tenant) {
        const { data: t, error: tErr } = await supabase
          .from('hrms_tenants')
          .insert({ name: 'Aviary Technologies', slug: 'aviary', status: 'Active' })
          .select().single();
        if (tErr) throw tErr;
        tenant = t;
      }

      const { count } = await supabase
        .from('hrms_users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);

      const { data: created, error: cErr } = await supabase
        .from('hrms_users')
        .insert({
          tenant_id: tenant.id,
          auth_id: auth_id || null,
          email: norm,
          full_name: name || norm.split('@')[0],
          avatar_url: avatar || null,
          role: (count || 0) === 0 ? 'Owner' : 'Member',
          prefs: { theme: 'soft', mode: 'light', language: 'en', wallpaper: 'none' },
        })
        .select().single();
      if (cErr) throw cErr;
      return res.status(200).json(created);
    }

    if (req.method === 'PUT') {
      const { id, prefs } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { data, error } = await supabase
        .from('hrms_users').update({ prefs }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('bootstrap API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
