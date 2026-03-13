import { useState, useRef, useEffect } from 'react';
import { recolorLogoCanvas } from '../utils/exportUtils.js';

export default function LogoPanel({ initialDomain, customerName, onLogoReady, logoDataUrl }) {
  const [domain, setDomain] = useState(initialDomain || '');
  const [hexColor, setHexColor] = useState('#2563eb');
  const [logoSrc, setLogoSrc] = useState(null); // raw logo from server
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [recoloring, setRecoloring] = useState(false);
  const imgRef = useRef();

  // Auto-fetch logo when component mounts if domain is provided
  useEffect(() => {
    if (initialDomain) {
      fetchLogo(initialDomain);
    }
  }, []); // eslint-disable-line

  const fetchLogo = async (d) => {
    const target = (d || domain).trim();
    if (!target) return;

    setLoadingLogo(true);
    setLogoError(null);
    setLogoSrc(null);
    onLogoReady(null);

    try {
      const url = `/api/logo?domain=${encodeURIComponent(target)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Logo not found for this domain');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setLogoSrc(objectUrl);
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLoadingLogo(false);
    }
  };

  const handleApplyColor = async () => {
    if (!logoSrc) return;
    setRecoloring(true);
    try {
      const dataUrl = await recolorLogoCanvas(logoSrc, hexColor);
      onLogoReady(dataUrl);
    } catch (err) {
      console.error('Recolor failed:', err);
    } finally {
      setRecoloring(false);
    }
  };

  // Auto-apply color when logo or hex changes
  useEffect(() => {
    if (logoSrc && hexColor.match(/^#[0-9a-fA-F]{6}$/)) {
      handleApplyColor();
    }
  }, [logoSrc, hexColor]); // eslint-disable-line

  const isValidHex = hexColor.match(/^#[0-9a-fA-F]{6}$/);

  return (
    <div className="logo-panel">
      <h3>Company Logo</h3>

      {/* Domain input */}
      <div className="logo-domain-row">
        <div className="field">
          <label>Company Domain</label>
          <div className="domain-input-row">
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogo()}
              className="text-input"
              placeholder="e.g. acme.com"
            />
            <button
              className="btn btn-secondary"
              onClick={() => fetchLogo()}
              disabled={loadingLogo || !domain.trim()}
            >
              {loadingLogo ? '…' : 'Fetch'}
            </button>
          </div>
          {customerName && !logoSrc && !loadingLogo && (
            <span className="field-hint">Auto-detected for: <strong>{customerName}</strong></span>
          )}
        </div>
      </div>

      {/* Logo error */}
      {logoError && (
        <div className="logo-error">
          {logoError}. Try entering the domain manually (e.g. <em>salesforce.com</em>).
        </div>
      )}

      {/* Logo preview */}
      <div className={`logo-preview-area ${!logoSrc && !loadingLogo ? 'empty' : ''}`}>
        {loadingLogo && (
          <div className="logo-loading">
            <div className="spinner-ring spinner-sm"></div>
            <span>Fetching logo…</span>
          </div>
        )}

        {logoSrc && !logoDataUrl && (
          <div className="logo-preview-inner">
            <img ref={imgRef} src={logoSrc} alt="Original logo" className="logo-img" crossOrigin="anonymous" />
            {recoloring && <div className="logo-overlay">Applying color…</div>}
          </div>
        )}

        {logoDataUrl && (
          <div className="logo-preview-inner">
            <img src={logoDataUrl} alt="Recolored logo" className="logo-img" />
            <div className="logo-badge">Color applied ✓</div>
          </div>
        )}

        {!logoSrc && !loadingLogo && (
          <div className="logo-placeholder">
            <span>🏢</span>
            <p>Enter a domain above to fetch the logo</p>
          </div>
        )}
      </div>

      {/* Color picker */}
      {logoSrc && (
        <div className="color-section">
          <label>Brand Color</label>
          <div className="color-row">
            <input
              type="color"
              value={isValidHex ? hexColor : '#2563eb'}
              onChange={e => setHexColor(e.target.value)}
              className="color-swatch"
              title="Pick a color"
            />
            <input
              type="text"
              value={hexColor}
              onChange={e => {
                const v = e.target.value;
                setHexColor(v.startsWith('#') ? v : '#' + v);
              }}
              className="hex-input"
              placeholder="#2563eb"
              maxLength={7}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleApplyColor}
              disabled={recoloring || !isValidHex}
            >
              Apply
            </button>
          </div>
          <span className="field-hint">Enter any hex color to recolor the logo</span>

          {/* Quick color presets */}
          <div className="color-presets">
            {['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0f172a', '#475569'].map(c => (
              <button
                key={c}
                className={`color-preset ${hexColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setHexColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
