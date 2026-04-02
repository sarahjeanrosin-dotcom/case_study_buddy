import { useState, useEffect } from 'react';
import LogoPanel from './LogoPanel.jsx';
import { downloadPDF, downloadZip } from '../utils/exportUtils.js';

// ── Editable array bucket ─────────────────────────────────────────────────────
function ArrayBucket({ label, items, onChange }) {
  const update = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="bucket">
      <div className="bucket-header">
        <h3>{label}</h3>
        <span className="bucket-count">{items.length}</span>
      </div>
      <div className="bucket-list">
        {items.map((item, i) => (
          <div key={i} className="bucket-item">
            <input
              type="text"
              value={item}
              onChange={e => update(i, e.target.value)}
              className="bucket-input"
              placeholder={`${label} item…`}
            />
            <button
              className="item-delete"
              onClick={() => remove(i)}
              title="Remove"
            >✕</button>
          </div>
        ))}
      </div>
      <button className="btn-add-item" onClick={add}>+ Add item</button>
    </div>
  );
}

// ── Quotes bucket ─────────────────────────────────────────────────────────────
function QuotesBucket({ quotes, onChange }) {
  const update = (i, field, val) => {
    const next = quotes.map((q, idx) => idx === i ? { ...q, [field]: val } : q);
    onChange(next);
  };
  const remove = (i) => onChange(quotes.filter((_, idx) => idx !== i));
  const add = () => onChange([...quotes, { text: '', attribution: '' }]);

  return (
    <div className="bucket">
      <div className="bucket-header">
        <h3>Notable Quotes</h3>
        <span className="bucket-count">{quotes.length}</span>
      </div>
      {quotes.length === 0 && (
        <p className="bucket-empty">No quotes found in this case study</p>
      )}
      {quotes.map((q, i) => (
        <div key={i} className="quote-item">
          <div className="quote-item-header">
            <span className="quote-mark">"</span>
            <button className="item-delete" onClick={() => remove(i)} title="Remove">✕</button>
          </div>
          <textarea
            value={q.text}
            onChange={e => update(i, 'text', e.target.value)}
            className="quote-text-input"
            placeholder="Quote text…"
            rows={3}
          />
          <input
            type="text"
            value={q.attribution || ''}
            onChange={e => update(i, 'attribution', e.target.value)}
            className="quote-attr-input"
            placeholder="Name, Title, Company (optional)"
          />
        </div>
      ))}
      <button className="btn-add-item" onClick={add}>+ Add quote</button>
    </div>
  );
}

// ── Text field bucket ─────────────────────────────────────────────────────────
function TextBucket({ label, value, onChange, multiline = false, rows = 4, hint }) {
  return (
    <div className="bucket">
      <div className="bucket-header">
        <h3>{label}</h3>
        {hint && <span className="bucket-hint">{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bucket-textarea"
          rows={rows}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bucket-input-full"
        />
      )}
    </div>
  );
}

// ── Main output page ──────────────────────────────────────────────────────────
export default function OutputPage({ initialData, tone, onReset }) {
  const [data, setData] = useState(initialData);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [zipping, setZipping] = useState(false);
  const [narrativeLoading, setNarrativeLoading] = useState(true);
  const [narrativeError, setNarrativeError] = useState(null);

  const set = (field) => (val) => setData(prev => ({ ...prev, [field]: val }));

  const generateNarrative = async () => {
    setNarrativeLoading(true);
    setNarrativeError(null);
    try {
      const res = await fetch('/.netlify/functions/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone,
          customer:          data.customer,
          industry:          data.industry,
          challenge:         data.challenge,
          use_case:          data.use_case,
          business_outcomes: data.business_outcomes,
          solutions:         data.solutions,
          quotes:            data.quotes,
        }),
      });
      const responseText = await res.text();
      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new Error(`HTTP ${res.status} — ${responseText.substring(0, 300)}`);
      }
      if (!res.ok) throw new Error(json.error || 'Narrative generation failed');
      setData(prev => ({ ...prev, narrative: json.narrative }));
    } catch (err) {
      setNarrativeError(err.message);
    } finally {
      setNarrativeLoading(false);
    }
  };

  useEffect(() => { generateNarrative(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadPDF = () => downloadPDF(data);

  const handleDownloadZip = async () => {
    setZipping(true);
    try {
      await downloadZip(data, logoDataUrl);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="output-layout">
      {/* Left: content editor */}
      <div className="output-editor">
        <div className="editor-header">
          <div>
            <h2>Generated Content</h2>
            <p className="editor-subtitle">Edit any field before downloading</p>
          </div>
          <button className="btn btn-primary" onClick={handleDownloadPDF}>
            ⬇ Download PDF
          </button>
        </div>

        <div className="buckets-grid">
          <div className="buckets-row">
            <TextBucket label="Customer" value={data.customer || ''} onChange={set('customer')} />
            <TextBucket label="Industry" value={data.industry || ''} onChange={set('industry')} />
          </div>

          <TextBucket label="Challenge" value={data.challenge || ''} onChange={set('challenge')} multiline />
          <TextBucket label="Use Case" value={data.use_case || ''} onChange={set('use_case')} multiline />

          <ArrayBucket
            label="Business Outcomes"
            items={data.business_outcomes || []}
            onChange={set('business_outcomes')}
          />

          <ArrayBucket
            label="Solutions"
            items={data.solutions || []}
            onChange={set('solutions')}
          />

          <ArrayBucket
            label="How Statements"
            items={data.how_statements || []}
            onChange={set('how_statements')}
          />

          <QuotesBucket
            quotes={data.quotes || []}
            onChange={set('quotes')}
          />

          <div className="bucket">
            <div className="bucket-header">
              <h3>Narrative Story</h3>
              <span className="bucket-hint">~1,400 words</span>
            </div>
            {narrativeLoading ? (
              <div className="narrative-loading">
                <span className="btn-spinner"></span>
                <span>Writing narrative…</span>
              </div>
            ) : narrativeError ? (
              <div className="narrative-error">
                <p>Narrative generation failed: {narrativeError}</p>
                <button className="btn btn-secondary" onClick={generateNarrative}>Retry</button>
              </div>
            ) : (
              <textarea
                value={data.narrative || ''}
                onChange={e => set('narrative')(e.target.value)}
                className="bucket-textarea"
                rows={32}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right: logo + export panel */}
      <div className="output-sidebar">
        <LogoPanel
          initialDomain={data.domain || ''}
          customerName={data.customer || ''}
          onLogoReady={setLogoDataUrl}
          logoDataUrl={logoDataUrl}
        />

        <div className="export-card">
          <h3>Export</h3>
          <div className="export-actions">
            <button
              className="btn btn-primary btn-full"
              onClick={handleDownloadZip}
              disabled={zipping}
            >
              {zipping ? <><span className="btn-spinner"></span> Packaging…</> : '⬇ Download ZIP'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={handleDownloadPDF}>
              ⬇ PDF only
            </button>
            {logoDataUrl && (
              <a
                className="btn btn-secondary btn-full"
                href={logoDataUrl}
                download="logo-recolored.png"
              >
                ⬇ Logo PNG only
              </a>
            )}
          </div>
          <p className="export-hint">
            {logoDataUrl
              ? 'ZIP includes the PDF + recolored logo PNG.'
              : 'ZIP includes the PDF. Fetch a logo above to include it too.'}
          </p>
        </div>

        <div className="reset-card">
          <button className="btn btn-ghost btn-full" onClick={onReset}>
            ← Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
