import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

export interface OrgPerson {
  id: number; full_name: string; email: string; gender: string; dept: string; role: string;
  status: string; location: string; employment_type: string; worker_type: string;
  nationality: string; business_unit: string; cost_center: string; legal_entity: string;
  joined: string; exit_date: string | null; exit_reason: string | null; exit_type: string | null;
  dob: string | null; salary: number;
}
export interface AuditRow {
  id: number; actor: string; category: string; sub_category: string;
  attribute: string; event: string; detail: string; created_at: string;
}

export function useOrgPeople() {
  const [people, setPeople] = useState<OrgPerson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api<OrgPerson[]>('organization?resource=people')
      .then(setPeople)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return { people: people || [], loading, error, reload: load };
}

export function countBy<T>(rows: T[], fn: (r: T) => string): { label: string; value: number }[] {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = fn(r) || 'Not Specified';
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([label, value]) => ({ label, value }));
}

export function ageOf(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
}

export function tenureYears(p: OrgPerson): number {
  const end = p.exit_date ? new Date(p.exit_date).getTime() : Date.now();
  return (end - new Date(p.joined).getTime()) / (365.25 * 864e5);
}

export const distinct = <T,>(rows: T[], fn: (r: T) => string): string[] =>
  [...new Set(rows.map(fn).filter(Boolean))].sort();
