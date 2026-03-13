import { useState } from 'react';
import LogoPanel from './LogoPanel.jsx';
import { downloadPDF } from '../utils/exportUtils.js';

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
function TextBucket({ label, value, onChange, multiline = false }) {
  return (
    <div className="bucket">
      <div className="bucket-header">
        <h3>{label}</h3>
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bucket-textarea"
          rows={4}
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
export default function OutputPage({ initialData, onReset }) {
  const [data, setData] = useState(initialData);
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  const set = (field) => (val) => setData(prev => ({ ...prev, [field]: val }));

  const handleDownloadPDF = () => {
    downloadPDF(data);
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
            <button className="btn btn-primary btn-full" onClick={handleDownloadPDF}>
              ⬇ Download PDF
            </button>
            {logoDataUrl && (
              <a
                className="btn btn-secondary btn-full"
                href={logoDataUrl}
                download="logo-recolored.png"
              >
                ⬇ Download Logo PNG
              </a>
            )}
          </div>
          <p className="export-hint">
            {!logoDataUrl && 'Fetch and recolor the logo above to enable logo download.'}
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
