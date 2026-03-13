import Anthropic from '@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { text, length } = JSON.parse(event.body || '{}');
  if (!text) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Text is required' }) };
  }

  const lengthGuide = {
    concise: 'VERY SHORT: 1-2 sentences for paragraph fields. Bullets: 6-10 words each.',
    strong:  'BALANCED: 2-3 sentences for paragraph fields. Bullets: 10-15 words each.',
    robust:  'DETAILED: 4-6 sentences for paragraph fields. Bullets: 15-25 words each.',
  };

  const prompt = `You are a marketing content specialist. Analyze the case study below and extract structured marketing content.

OUTPUT LENGTH: ${(length || 'strong').toUpperCase()} — ${lengthGuide[length] || lengthGuide.strong}

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
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text response from Claude');

    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const data = JSON.parse(jsonStr);

    if (!Array.isArray(data.business_outcomes)) data.business_outcomes = [];
    if (!Array.isArray(data.solutions)) data.solutions = [];
    if (!Array.isArray(data.how_statements)) data.how_statements = [];
    if (!Array.isArray(data.quotes)) data.quotes = [];

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Content generation failed: ${err.message}` }),
    };
  }
};
