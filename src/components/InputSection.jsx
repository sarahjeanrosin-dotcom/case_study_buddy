import { useState, useRef } from 'react';

const LENGTH_OPTIONS = [
  { value: 'concise', label: 'Concise', desc: 'Short, slide-friendly' },
  { value: 'strong',  label: 'Strong',  desc: 'Balanced detail' },
  { value: 'robust',  label: 'Robust',  desc: 'Fully detailed' },
];

export default function InputSection({ onGenerate }) {
  const [mode, setMode] = useState('url'); // 'url' | 'pdf'
  const [url, setUrl] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [length, setLength] = useState('strong');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let text = '';

      if (mode === 'url') {
        if (!url.trim()) throw new Error('Please enter a URL');
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch URL');
        if (!json.text || json.text.length < 100) throw new Error('Could not extract enough content from that URL. Try copying the text and using the PDF upload instead.');
        text = json.text;
      } else {
        if (!pdfFile) throw new Error('Please select a PDF file');
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to parse PDF');
        if (!json.text || json.text.length < 100) throw new Error('Could not extract text from this PDF. Make sure it contains selectable text (not a scanned image).');
        text = json.text;
      }

      await onGenerate({ text, length });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    setPdfFile(file || null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
    } else {
      setError('Please drop a PDF file');
    }
  };

  return (
    <div className="input-wrapper">
      <div className="input-card">
        <div className="input-card-header">
          <h2>Import Case Study</h2>
          <p>Paste a URL or upload a PDF to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          {/* Mode toggle */}
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${mode === 'url' ? 'active' : ''}`}
              onClick={() => { setMode('url'); setError(null); }}
            >
              🔗 URL
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'pdf' ? 'active' : ''}`}
              onClick={() => { setMode('pdf'); setError(null); }}
            >
              📄 PDF
            </button>
          </div>

          {/* URL input */}
          {mode === 'url' && (
            <div className="field">
              <label htmlFor="url-input">Case Study URL</label>
              <input
                id="url-input"
                type="url"
                placeholder="https://example.com/case-study/acme-corp"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="text-input"
                required
              />
              <span className="field-hint">Paste the full URL of the case study page</span>
            </div>
          )}

          {/* PDF upload */}
          {mode === 'pdf' && (
            <div className="field">
              <label>PDF File</label>
              <div
                className={`drop-zone ${pdfFile ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {pdfFile ? (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <div>
                      <div className="file-name">{pdfFile.name}</div>
                      <div className="file-size">{(pdfFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button
                      type="button"
                      className="file-clear"
                      onClick={e => { e.stopPropagation(); setPdfFile(null); }}
                    >✕</button>
                  </div>
                ) : (
                  <div className="drop-prompt">
                    <span className="drop-icon">⬆️</span>
                    <div>
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div className="drop-hint">PDF files only, up to 50MB</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Length selector */}
          <div className="field">
            <label>Output Length</label>
            <div className="length-options">
              {LENGTH_OPTIONS.map(opt => (
                <label key={opt.value} className={`length-option ${length === opt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="length"
                    value={opt.value}
                    checked={length === opt.value}
                    onChange={() => setLength(opt.value)}
                  />
                  <span className="length-label">{opt.label}</span>
                  <span className="length-desc">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <div className="field-error">{error}</div>}

          {/* Submit */}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? (
              <><span className="btn-spinner"></span> Fetching content…</>
            ) : (
              '✦ Generate Content Buckets'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
