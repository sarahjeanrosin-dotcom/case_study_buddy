import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Fetch URL and extract readable text ──────────────────────────────────────
app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('script, style, nav, header, footer, .nav, .header, .footer, .menu, .sidebar, .ad, .advertisement, .cookie-banner, .popup, noscript, iframe, [role="navigation"], [aria-label="navigation"]').remove();

    // Try to find the main content in order of preference
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

    // Clean whitespace
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    res.json({ text: text.substring(0, 25000), title: $('title').text().trim() });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch URL: ${err.message}` });
  }
});

// PDF parsing moved to client-side (pdfjs-dist in browser)

// ── Generate structured content via Claude ───────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { text, length, tone } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const lengthGuide = {
    concise: 'VERY SHORT: 1-2 sentences for paragraph fields. Bullets: 6-10 words each.',
    strong:  'BALANCED: 2-3 sentences for paragraph fields. Bullets: 10-15 words each.',
    robust:  'DETAILED: 4-6 sentences for paragraph fields. Bullets: 15-25 words each.',
  };

  const toneGuide = {
    facts:        'TONE — Just the Facts: Sharp and clean. Lead with data and metrics. No filler words, no personality. State outcomes plainly. Avoid adjectives unless quantifying. Example style: "Reduced processing time by 40%. Eliminated manual reconciliation. Scaled to 10M records per day."',
    punchy:       'TONE — Punchy Confidence: Short, punchy sentences. Active voice. Confident and slightly cheeky, but still professional. Don\'t hedge. Example style: "They had a mess. Now they don\'t. The team moved three times faster and never looked back."',
    storytelling: 'TONE — Storytelling: Human, empathetic, narrative-driven. Write like you\'re telling someone\'s real story. Focus on real challenges, real people, real wins. Use "their team", "the company", "they discovered". Example style: "When the team inherited a decade of legacy debt, they knew something had to change. What they didn\'t expect was how quickly it could."',
    strategic:    'TONE — Strategic Operator: Executive-level language. Smart, structured, quietly impressive. Use precise business language. Understated confidence. Example style: "The organization realigned its data infrastructure to eliminate operational bottlenecks, enabling the revenue team to accelerate pipeline velocity by 35%."',
  };

  const prompt = `You are a marketing content specialist. Analyze the case study below and extract structured marketing content.

OUTPUT LENGTH: ${length.toUpperCase()} — ${lengthGuide[length] || lengthGuide.strong}

${toneGuide[tone] || toneGuide.punchy}

CASE STUDY TEXT:
${text.substring(0, 20000)}

Return ONLY valid JSON. No markdown fences, no explanation, just the JSON object:

{
  "customer": "Company name featured in the case study",
  "industry": "Company's industry or vertical",
  "challenge": "The main challenge the company faced before the solution",
  "use_case": "Summary of how the solution was used",
  "business_outcomes": [
    "Business outcome 1",
    "Business outcome 2",
    "Business outcome 3",
    "Business outcome 4"
  ],
  "solutions": [
    "Solution implemented 1",
    "Solution implemented 2",
    "Solution implemented 3",
    "Solution implemented 4"
  ],
  "how_statements": [
    "How [specific outcome was achieved through specific action]",
    "How [another outcome was achieved]"
  ],
  "quotes": [
    {
      "text": "Exact quote text from the case study",
      "attribution": "Full Name, Title, Company (if available)"
    }
  ],
  "domain": "companydomain.com"
}

RULES:
- business_outcomes: EXACTLY 4 items
- solutions: EXACTLY 4 items
- how_statements: 1 or more items, each MUST begin with the word "How"
- quotes: include ALL meaningful testimonial-style quotes from the text; empty array [] if none found
- domain: your best inference of the customer company's website domain (for logo lookup)`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text response from Claude');

    let jsonStr = textBlock.text.trim();
    // Extract JSON if wrapped in markdown or extra text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const data = JSON.parse(jsonStr);

    // Enforce structure
    if (!Array.isArray(data.business_outcomes)) data.business_outcomes = [];
    if (!Array.isArray(data.solutions)) data.solutions = [];
    if (!Array.isArray(data.how_statements)) data.how_statements = [];
    if (!Array.isArray(data.quotes)) data.quotes = [];

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Content generation failed: ${err.message}` });
  }
});

// ── Shared fetch helper ───────────────────────────────────────────────────────
const fetchWithTimeout = (url, options = {}, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// ── Proxy a single logo image (used by LogoPanel to render variants) ──────────
app.get('/api/logo-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  try {
    const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'CaseStudyBuddy/1.0' } });
    if (!response.ok) return res.status(404).json({ error: 'Image not found' });

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(Buffer.from(buffer));
  } catch {
    return res.status(404).json({ error: 'Failed to fetch image' });
  }
});

// ── Return all available logo variants for a domain ───────────────────────────
// Returns JSON array of { type, label, url } objects
app.get('/api/logos', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const clean = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const variants = [];

  // ── Try Brandfetch API (if key configured) ──────────────────────────────────
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
            const isVector = format.format === 'svg';
            const label = logo.type === 'icon' ? 'Icon' : logo.type === 'logo' ? 'Wordmark' : logo.type;
            variants.push({
              type:    logo.type,
              label:   `${label}${isVector ? ' (SVG)' : ''}`,
              url:     `/api/logo-proxy?url=${encodeURIComponent(format.src)}`,
              width:   format.width,
              height:  format.height,
              source:  'brandfetch',
            });
          }
        }
      }
    } catch {
      // Brandfetch failed — fall through to free sources
    }
  }

  // ── Always try Clearbit (icon) ──────────────────────────────────────────────
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
          url:    `/api/logo-proxy?url=${encodeURIComponent(`https://logo.clearbit.com/${clean}`)}`,
          source: 'clearbit',
        });
      }
    }
  } catch { /* skip */ }

  // ── Google favicon fallback ─────────────────────────────────────────────────
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
            url:    `/api/logo-proxy?url=${encodeURIComponent(`https://www.google.com/s2/favicons?domain=${clean}&sz=128`)}`,
            source: 'google',
          });
        }
      }
    } catch { /* skip */ }
  }

  if (variants.length === 0) {
    return res.status(404).json({ error: `No logo found for "${clean}". Try a different domain.` });
  }

  // Deduplicate by url
  const seen = new Set();
  const deduped = variants.filter(v => {
    if (seen.has(v.url)) return false;
    seen.add(v.url);
    return true;
  });

  res.set('Cache-Control', 'public, max-age=3600');
  res.json(deduped);
});

// ── Legacy single-logo endpoint (kept for backwards compat) ───────────────────
app.get('/api/logo', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const clean = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const sources = [
    `https://logo.clearbit.com/${clean}`,
    `https://www.google.com/s2/favicons?domain=${clean}&sz=128`,
  ];

  for (const url of sources) {
    try {
      const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'CaseStudyBuddy/1.0' } });
      if (!response.ok) continue;

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      if (url.includes('google.com') && buffer.byteLength < 900) continue;

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(Buffer.from(buffer));
    } catch {
      continue;
    }
  }

  res.status(404).json({ error: `No logo found for "${clean}". Try a different domain.` });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Case Study Buddy server running → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY not set — content generation will fail');
  }
});
