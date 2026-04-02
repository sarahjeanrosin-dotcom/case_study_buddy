import { useState } from 'react';
import InputSection from './components/InputSection.jsx';
import OutputPage from './components/OutputPage.jsx';

export default function App() {
  const [step, setStep] = useState('input'); // 'input' | 'generating' | 'output'
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tone, setTone] = useState('punchy');

  const handleGenerate = async ({ text, length, tone: selectedTone }) => {
    setTone(selectedTone);
    setStep('generating');
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, length, tone: selectedTone }),
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
            <svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="14" r="9" fill="#7c3aed"/>
              <circle cx="16" cy="14" r="5.5" fill="#a78bfa"/>
              <circle cx="48" cy="14" r="9" fill="#7c3aed"/>
              <circle cx="48" cy="14" r="5.5" fill="#a78bfa"/>
              <circle cx="32" cy="36" r="24" fill="#7c3aed"/>
              <ellipse cx="32" cy="44" rx="11" ry="8" fill="#a78bfa"/>
              <circle cx="24" cy="32" r="3.5" fill="white"/>
              <circle cx="40" cy="32" r="3.5" fill="white"/>
              <circle cx="25" cy="33" r="2" fill="#1e1b4b"/>
              <circle cx="41" cy="33" r="2" fill="#1e1b4b"/>
              <circle cx="26" cy="32" r="0.8" fill="white"/>
              <circle cx="42" cy="32" r="0.8" fill="white"/>
              <ellipse cx="32" cy="42" rx="4" ry="2.5" fill="#4c1d95"/>
              <path d="M 27 46 Q 32 50 37 46" stroke="#4c1d95" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
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
          <OutputPage initialData={data} tone={tone} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
