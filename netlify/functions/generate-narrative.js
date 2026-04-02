import Anthropic from '@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const toneGuide = {
  facts:        'TONE — Just the Facts: Sharp and clean. Lead with data and metrics. No filler words, no personality. State outcomes plainly. Avoid adjectives unless quantifying.',
  punchy:       'TONE — Punchy Confidence: Write like a confident copywriter who has zero patience for corporate fluff. Short sentences. Fragments are fine. Active voice only. Lead with the result. Use contractions. A little swagger is good — but keep it professional. NO "leveraged", "utilized", "robust", or "seamless".',
  storytelling: 'TONE — Storytelling: Human, empathetic, narrative-driven. Write like you\'re telling someone\'s real story. Focus on real challenges, real people, real wins.',
  strategic:    'TONE — Strategic Operator: Executive-level language. Smart, structured, quietly impressive. Use precise business language. Understated confidence.',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { tone, customer, industry, challenge, use_case, business_outcomes, solutions, quotes } = JSON.parse(event.body || '{}');
  if (!customer) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'customer field is required' }) };
  }

  const outcomesText = (business_outcomes || []).map((o, i) => `  ${i + 1}. ${o}`).join('\n');
  const solutionsText = (solutions || []).map((s, i) => `  ${i + 1}. ${s}`).join('\n');
  const quotesText = (quotes || []).map(q => `  "${q.text}" — ${q.attribution}`).join('\n');

  const prompt = `You are a marketing content specialist. Write a compelling case study narrative story of approximately 1,400 words.

${toneGuide[tone] || toneGuide.punchy}

STRUCTURED DATA ABOUT THIS CASE STUDY:
Customer: ${customer}
Industry: ${industry || 'N/A'}
Challenge: ${challenge || 'N/A'}
Use Case: ${use_case || 'N/A'}
Business Outcomes:
${outcomesText || '  (none provided)'}
Solutions Implemented:
${solutionsText || '  (none provided)'}
Quotes:
${quotesText || '  (none)'}

Write the narrative as flowing prose with four plain-text section headers (no # symbols, no markdown):

THE BEFORE
[Set the scene: who this company is, what challenge they faced, why it mattered. 2–3 paragraphs.]

THE TURNING POINT
[What changed. Why they chose this path. What the decision looked like. 2–3 paragraphs.]

THE BUILD
[How it was implemented. What the team did. Specific actions and any friction or early wins. 2–3 paragraphs.]

THE AFTER
[Specific outcomes. Hard numbers where available. Weave in any quotes. What this unlocks going forward. 2–3 paragraphs.]

RULES:
- Approximately 1,400 words total (1,300–1,500)
- Use ALL specific numbers, metrics, and quotes from the structured data above
- Do NOT add facts not present in the structured data
- Plain text only — no markdown, no bullet points, no bold/italic
- Output ONLY the narrative text. No preamble, no "Here is the narrative:", just the story.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text response from Claude');

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ narrative: textBlock.text.trim() }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Narrative generation failed: ${err.message}` }),
    };
  }
};
