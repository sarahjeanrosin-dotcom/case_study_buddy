import * as cheerio from 'cheerio';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { url } = JSON.parse(event.body || '{}');
  if (!url) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'URL is required' }) };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, nav, header, footer, .nav, .header, .footer, .menu, .sidebar, .ad, .advertisement, .cookie-banner, noscript, iframe, [role="navigation"]').remove();

    const selectors = ['main', 'article', '[role="main"]', '.case-study', '.content', '.post-content', '.entry-content', '#content', 'body'];
    let text = '';
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        text = el.text();
        break;
      }
    }
    if (!text) text = $('body').text();

    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ text: text.substring(0, 25000), title: $('title').text().trim() }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Failed to fetch URL: ${err.message}` }),
    };
  }
};
