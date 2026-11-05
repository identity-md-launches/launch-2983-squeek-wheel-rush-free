const PROJECT_URL = 'https://baugveuujnzqsuehfrxz.supabase.co';
// Public browser key provided for this game. It is sent only in the apikey header.
const PUBLISHABLE_KEY = 'sb_publishable_WruR0oYAecH4If6PT9uj2A_YOsjdQZP';
export const STATUS_URL = 'https://api.squeekchain.com/v1/status';

/** @typedef {{ name:string, score:number, secs:number }} ScoreRow */
/** @param {string} method @param {Record<string, number|string>} body */
async function rpc(method, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${PROJECT_URL}/rest/v1/rpc/${method}`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
    });
    const value = await response.json();
    if (!response.ok || value?.message) throw new Error(value?.message || 'unavailable');
    return value;
  } finally { clearTimeout(timeout); }
}

/** @returns {Promise<ScoreRow[]>} */
export async function topScores() {
  const rows = await rpc('top_scores', { n: 20 });
  if (!Array.isArray(rows)) throw new Error('unavailable');
  return rows.filter(row => typeof row.name === 'string' && Number.isSafeInteger(row.score) && row.score >= 0 && Number.isFinite(row.secs) && row.secs >= 0);
}

/** @param {string} name @param {number} score @param {number} secs @returns {Promise<{rank:number,name:string}>} */
export async function submitScore(name, score, secs) {
  const result = await rpc('submit_score', { p_name: name, p_score: Math.floor(score), p_secs: Math.floor(secs) });
  if (typeof result?.name !== 'string' || !Number.isSafeInteger(result.rank) || result.rank < 1) throw new Error('unavailable');
  return result;
}

/** @param {unknown} value */
export function isLiveMeasurement(value) {
  if (!value || typeof value !== 'object' || !('measurement' in value)) return false;
  const m = value.measurement;
  return !!m && typeof m === 'object' && 'freshness' in m && m.freshness === 'online' && 'rpmMilli' in m && typeof m.rpmMilli === 'number' && m.rpmMilli > 0;
}
