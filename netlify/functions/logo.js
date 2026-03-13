const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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

  const fetchWithTimeout = (url, ms = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CaseStudyBuddy/1.0' },
    }).finally(() => clearTimeout(timer));
  };

  const sources = [
    `https://logo.clearbit.com/${clean}`,
    `https://www.google.com/s2/favicons?domain=${clean}&sz=128`,
  ];

  for (const url of sources) {
    try {
      const response = await fetchWithTimeout(url, 8000);
      if (!response.ok) continue;

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      // Skip Google's generic globe icon (≈843 bytes)
      if (url.includes('google.com') && buffer.byteLength < 900) continue;

      const base64 = Buffer.from(buffer).toString('base64');

      return {
        statusCode: 200,
        headers: {
          ...CORS,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
        body: base64,
        isBase64Encoded: true,
      };
    } catch {
      continue;
    }
  }

  return {
    statusCode: 404,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: `No logo found for "${clean}". Try a different domain.` }),
  };
};
