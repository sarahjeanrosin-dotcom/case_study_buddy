import { useState } from 'react';
import InputSection from './components/InputSection.jsx';
import OutputPage from './components/OutputPage.jsx';

export default function App() {
  const [step, setStep] = useState('input'); // 'input' | 'generating' | 'output'
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleGenerate = async ({ text, length }) => {
    setStep('generating');
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, length }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setData(json);
      setStep('output');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleReset = () => {
    setStep('input');
    setData(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#2563eb"/>
              <path d="M7 8h14M7 12h10M7 16h12M7 20h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="header-title">Case Study Buddy</span>
          </div>
          {step === 'output' && (
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              ← New Case Study
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
            <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {step === 'input' && (
          <InputSection onGenerate={handleGenerate} />
        )}

        {step === 'generating' && (
          <div className="generating-screen">
            <div className="spinner-ring"></div>
            <h2>Analyzing case study…</h2>
            <p>Claude is reading the content and extracting marketing buckets.<br />This typically takes 15–30 seconds.</p>
          </div>
        )}

        {step === 'output' && data && (
          <OutputPage initialData={data} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
