const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const fetchWithTimeout = (url, options = {}, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const domain = event.queryStringParameters?.domain;
  if (!domain) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Domain is required' }),
    };
  }

  const clean = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const variants = [];

  // ── Brandfetch Brand API (if key configured) ──────────────────────────────
  const brandfetchKey = process.env.BRANDFETCH_API_KEY;
  if (brandfetchKey) {
    try {
      const bfRes = await fetchWithTimeout(
        `https://api.brandfetch.io/v2/brands/${encodeURIComponent(clean)}`,
        { headers: { Authorization: `Bearer ${brandfetchKey}`, 'User-Agent': 'CaseStudyBuddy/1.0' } },
        10000
      );
      if (bfRes.ok) {
        const bfData = await bfRes.json();
        const logos = bfData.logos || [];
        for (const logo of logos) {
          for (const format of (logo.formats || [])) {
            if (!format.src) continue;
            const label = logo.type === 'icon' ? 'Icon' : logo.type === 'logo' ? 'Wordmark' : logo.type;
            const isVector = format.format === 'svg';
            variants.push({
              type:   logo.type,
              label:  `${label}${isVector ? ' (SVG)' : ''}`,
              url:    `/.netlify/functions/logo-proxy?url=${encodeURIComponent(format.src)}`,
              source: 'brandfetch',
            });
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // ── Clearbit (icon) ───────────────────────────────────────────────────────
  try {
    const cbRes = await fetchWithTimeout(
      `https://logo.clearbit.com/${clean}`,
      { headers: { 'User-Agent': 'CaseStudyBuddy/1.0' } }
    );
    if (cbRes.ok) {
      const buf = await cbRes.arrayBuffer();
      if (buf.byteLength > 200) {
        variants.push({
          type:   'icon',
          label:  'Icon (Clearbit)',
          url:    `/.netlify/functions/logo-proxy?url=${encodeURIComponent(`https://logo.clearbit.com/${clean}`)}`,
          source: 'clearbit',
        });
      }
    }
  } catch { /* skip */ }

  // ── Google favicon fallback ───────────────────────────────────────────────
  if (variants.length === 0) {
    try {
      const gRes = await fetchWithTimeout(
        `https://www.google.com/s2/favicons?domain=${clean}&sz=128`,
        { headers: { 'User-Agent': 'CaseStudyBuddy/1.0' } }
      );
      if (gRes.ok) {
        const buf = await gRes.arrayBuffer();
        if (buf.byteLength > 900) {
          variants.push({
            type:   'icon',
            label:  'Favicon',
            url:    `/.netlify/functions/logo-proxy?url=${encodeURIComponent(`https://www.google.com/s2/favicons?domain=${clean}&sz=128`)}`,
            source: 'google',
          });
        }
      }
    } catch { /* skip */ }
  }

  if (variants.length === 0) {
    return {
      statusCode: 404,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `No logo found for "${clean}". Try a different domain.` }),
    };
  }

  // Deduplicate by url
  const seen = new Set();
  const deduped = variants.filter(v => {
    if (seen.has(v.url)) return false;
    seen.add(v.url);
    return true;
  });

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    body: JSON.stringify(deduped),
  };
};
