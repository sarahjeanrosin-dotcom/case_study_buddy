import { useState, useEffect } from 'react';
import { recolorLogoCanvas } from '../utils/exportUtils.js';

export default function LogoPanel({ initialDomain, customerName, onLogoReady, logoDataUrl }) {
  const [domain, setDomain] = useState(initialDomain || '');
  const [hexColor, setHexColor] = useState('#2563eb');
  const [variants, setVariants] = useState([]);       // all fetched variants
  const [selectedUrl, setSelectedUrl] = useState(null); // currently selected variant URL
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [recoloring, setRecoloring] = useState(false);

  // Auto-fetch when component mounts if domain is provided
  useEffect(() => {
    if (initialDomain) fetchLogos(initialDomain);
  }, []); // eslint-disable-line

  const fetchLogos = async (d) => {
    const target = (d || domain).trim();
    if (!target) return;

    setLoadingLogo(true);
    setLogoError(null);
    setVariants([]);
    setSelectedUrl(null);
    onLogoReady(null);

    try {
      const res = await fetch(`/api/logos?domain=${encodeURIComponent(target)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Logo not found');
      setVariants(json);
      setSelectedUrl(json[0]?.url || null);
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLoadingLogo(false);
    }
  };

  const handleApplyColor = async (srcUrl) => {
    const url = srcUrl || selectedUrl;
    if (!url) return;
    setRecoloring(true);
    try {
      const dataUrl = await recolorLogoCanvas(url, hexColor);
      onLogoReady(dataUrl);
    } catch (err) {
      console.error('Recolor failed:', err);
    } finally {
      setRecoloring(false);
    }
  };

  // Auto-apply color when selected variant or hex changes
  useEffect(() => {
    if (selectedUrl && hexColor.match(/^#[0-9a-fA-F]{6}$/)) {
      handleApplyColor(selectedUrl);
    }
  }, [selectedUrl, hexColor]); // eslint-disable-line

  const isValidHex = hexColor.match(/^#[0-9a-fA-F]{6}$/);
  const hasVariants = variants.length > 0;

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
              onKeyDown={e => e.key === 'Enter' && fetchLogos()}
              className="text-input"
              placeholder="e.g. acme.com"
            />
            <button
              className="btn btn-secondary"
              onClick={() => fetchLogos()}
              disabled={loadingLogo || !domain.trim()}
            >
              {loadingLogo ? '…' : 'Fetch'}
            </button>
          </div>
          {customerName && !hasVariants && !loadingLogo && (
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

      {/* Variant picker — shown when multiple logos available */}
      {hasVariants && variants.length > 1 && (
        <div className="logo-variants">
          <span className="logo-variants-label">{variants.length} variants found — pick one:</span>
          <div className="logo-variants-grid">
            {variants.map((v, i) => (
              <button
                key={i}
                className={`logo-variant-thumb ${selectedUrl === v.url ? 'selected' : ''}`}
                onClick={() => setSelectedUrl(v.url)}
                title={v.label}
              >
                <img src={v.url} alt={v.label} crossOrigin="anonymous" />
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Logo preview */}
      <div className={`logo-preview-area ${!selectedUrl && !loadingLogo ? 'empty' : ''}`}>
        {loadingLogo && (
          <div className="logo-loading">
            <div className="spinner-ring spinner-sm"></div>
            <span>Fetching logo…</span>
          </div>
        )}

        {selectedUrl && !logoDataUrl && (
          <div className="logo-preview-inner">
            <img src={selectedUrl} alt="Logo" className="logo-img" crossOrigin="anonymous" />
            {recoloring && <div className="logo-overlay">Applying color…</div>}
          </div>
        )}

        {logoDataUrl && (
          <div className="logo-preview-inner">
            <img src={logoDataUrl} alt="Recolored logo" className="logo-img" />
            <div className="logo-badge">Color applied ✓</div>
          </div>
        )}

        {!selectedUrl && !loadingLogo && (
          <div className="logo-placeholder">
            <span>🏢</span>
            <p>Enter a domain above to fetch the logo</p>
          </div>
        )}
      </div>

      {/* Color picker */}
      {selectedUrl && (
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
              onClick={() => handleApplyColor()}
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
