import { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

function getFileExtension(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.doc')) return 'doc';
  if (name.endsWith('.txt')) return 'txt';
  return null;
}

function finalizeText(text, notEnoughMessage) {
  const cleaned = text.replace(/[ \t]+/g, ' ').trim();
  if (!cleaned || cleaned.length < 100) {
    throw new Error(notEnoughMessage);
  }
  return cleaned.substring(0, 25000);
}

async function parsePDFInBrowser(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return finalizeText(
    pages.join('\n\n'),
    'Could not extract text from this PDF. It may be a scanned image — try the URL option instead.'
  );
}

async function parseDocxInBrowser(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return finalizeText(
    result.value,
    'Could not extract text from this document. It may be empty or corrupted.'
  );
}

async function parseTxtInBrowser(file) {
  const text = await file.text();
  return finalizeText(
    text,
    'This text file has too little content to work with.'
  );
}

async function parseFileInBrowser(file) {
  const ext = getFileExtension(file);
  if (ext === 'pdf') return parsePDFInBrowser(file);
  if (ext === 'docx') return parseDocxInBrowser(file);
  if (ext === 'txt') return parseTxtInBrowser(file);
  if (ext === 'doc') {
    throw new Error('Legacy .doc files aren\'t supported — please re-save as .docx, PDF, or plain text (.txt).');
  }
  throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
}

const LENGTH_OPTIONS = [
  { value: 'concise', label: 'Concise', desc: 'Short, slide-friendly' },
  { value: 'strong',  label: 'Strong',  desc: 'Balanced detail' },
  { value: 'robust',  label: 'Robust',  desc: 'Fully detailed' },
];

const TONE_OPTIONS = [
  { value: 'facts',       label: 'Just the Facts',      desc: 'Sharp. Clean. No personality, just proof.' },
  { value: 'punchy',      label: 'Punchy Confidence',   desc: 'Confident, slightly cheeky, but still professional.' },
  { value: 'storytelling',label: 'Storytelling',         desc: 'Human, empathetic, grounded in real experience.' },
  { value: 'strategic',   label: 'Strategic Operator',  desc: 'Smart, structured, quietly impressive.' },
];

export default function InputSection({ onGenerate }) {
  const [mode, setMode] = useState('url'); // 'url' | 'file'
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [length, setLength] = useState('strong');
  const [tone, setTone] = useState('punchy');
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
        if (!json.text || json.text.length < 100) throw new Error('Could not extract enough content from that URL. Try uploading a PDF, DOCX, or TXT file instead.');
        text = json.text;
      } else {
        if (!file) throw new Error('Please select a file');
        text = await parseFileInBrowser(file);
      }

      await onGenerate({ text, length, tone });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateAndSetFile = (candidate) => {
    if (!candidate) return;
    const ext = getFileExtension(candidate);
    if (ext === 'doc') {
      setError('Legacy .doc files aren\'t supported — please re-save as .docx, PDF, or plain text (.txt).');
      return;
    }
    if (!ACCEPTED_EXTENSIONS.some(e => candidate.name.toLowerCase().endsWith(e))) {
      setError('Please select a PDF, DOCX, or TXT file');
      return;
    }
    setFile(candidate);
    setError(null);
  };

  const handleFileChange = (e) => {
    validateAndSetFile(e.target.files[0] || null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    validateAndSetFile(e.dataTransfer.files[0] || null);
  };

  return (
    <div className="input-wrapper">
      <div className="input-card">
        <div className="input-card-header">
          <h2>Import Case Study</h2>
          <p>Paste a URL or upload a file to get started</p>
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
              className={`mode-btn ${mode === 'file' ? 'active' : ''}`}
              onClick={() => { setMode('file'); setError(null); }}
            >
              📄 File
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

          {/* File upload */}
          {mode === 'file' && (
            <div className="field">
              <label>Case Study File</label>
              <div
                className={`drop-zone ${file ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {file ? (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <div>
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button
                      type="button"
                      className="file-clear"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                    >✕</button>
                  </div>
                ) : (
                  <div className="drop-prompt">
                    <span className="drop-icon">⬆️</span>
                    <div>
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div className="drop-hint">PDF, DOCX, or TXT files, up to 50MB</div>
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

          {/* Tone selector */}
          <div className="field">
            <label>Tone</label>
            <div className="tone-options">
              {TONE_OPTIONS.map(opt => (
                <label key={opt.value} className={`tone-option ${tone === opt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="tone"
                    value={opt.value}
                    checked={tone === opt.value}
                    onChange={() => setTone(opt.value)}
                  />
                  <span className="tone-label">{opt.label}</span>
                  <span className="tone-desc">{opt.desc}</span>
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
