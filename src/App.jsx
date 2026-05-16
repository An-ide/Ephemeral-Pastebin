import React, { useState, useEffect, useCallback } from 'react';
import LZString from 'lz-string';
import { encryptWithPassword, decryptWithPassword } from './utils/crypto';

const ICONS = {
  clipboard: 'https://static.vecteezy.com/system/resources/thumbnails/049/099/935/small/blank-clipboard-with-wooden-board-cut-out-transparent-png.png',
  viewPaste: 'https://images.emojiterra.com/google/noto-emoji/unicode-16.0/bw/512px/1f4c4.png',
  link: 'https://www.pngarts.com/files/3/URL-Chain-Link-PNG-Image-Background.png',
  password: 'https://icons.veryicon.com/png/o/miscellaneous/face-monochrome-icon/password-76.png',
  warning: 'https://uxwing.com/wp-content/themes/uxwing/download/signs-and-symbols/warning-icon.png',
  refresh: 'https://www.i2symbol.com/images/symbols/arrows/anticlockwise_open_circle_arrow_u21ba_icon_256x256.png',
  copy: 'https://cdn-icons-png.flaticon.com/512/1621/1621635.png',
};

function App() {
  const [mode, setMode] = useState('create');
  const [text, setText] = useState('');
  const [decryptedText, setDecryptedText] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [expiration, setExpiration] = useState('');
  const [expired, setExpired] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [showPasswordChoiceModal, setShowPasswordChoiceModal] = useState(false);
  const [shouldEncrypt, setShouldEncrypt] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(hash);
      if (!decompressed) throw new Error();
      let payload = decompressed;
      let expiresAt = null;
      if (payload.includes('|exp=')) {
        const parts = payload.split('|exp=');
        payload = parts[0];
        expiresAt = parseInt(parts[1], 10);
      }
      if (expiresAt && Date.now() > expiresAt) {
        setExpired(true);
        setMode('view');
        return;
      }
      let isEncrypted = false;
      let finalData = payload;
      if (payload.startsWith('enc|')) {
        isEncrypted = true;
        finalData = payload.slice(4);
      }
      if (isEncrypted) {
        setPendingAction({ type: 'decrypt', data: finalData });
        setShowPasswordDialog(true);
      } else {
        setDecryptedText(finalData);
        setMode('view');
        showToast('Loaded from URL – never stored.', 'info');
      }
    } catch (err) {
      showToast('Invalid or corrupted paste');
    }
  }, []);

  const createPaste = useCallback(async (useEncryption, pwd = '') => {
    if (!text.trim()) {
      showToast('Please enter some text.');
      return false;
    }
    let payload = text;
    if (useEncryption) {
      if (!pwd) {
        showToast('Password cannot be empty.');
        return false;
      }
      try {
        const encryptedJson = await encryptWithPassword(text, pwd);
        payload = 'enc|' + encryptedJson;
      } catch (err) {
        showToast('Encryption failed.');
        return false;
      }
    }
    let expiresAt = null;
    if (expiration === '1h') expiresAt = Date.now() + 3600000;
    else if (expiration === '1d') expiresAt = Date.now() + 86400000;
    else if (expiration === '7d') expiresAt = Date.now() + 604800000;
    if (expiresAt) payload += '|exp=' + expiresAt;
    const compressed = LZString.compressToEncodedURIComponent(payload);
    const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
    setGeneratedUrl(url);
    setOriginalUrl(url);
    showToast('Link created!', 'success');
    return true;
  }, [text, expiration]);

  const handleCreateClick = () => {
    if (!text.trim()) {
      showToast('Please enter some text.');
      return;
    }
    setShouldEncrypt(false);
    setTempPassword('');
    setShowPasswordChoiceModal(true);
  };

  const handlePasswordChoiceConfirm = async () => {
    setShowPasswordChoiceModal(false);
    if (shouldEncrypt) {
      if (!tempPassword) {
        showToast('Password cannot be empty.');
        return;
      }
      await createPaste(true, tempPassword);
    } else {
      await createPaste(false);
    }
  };

  const handleDecrypt = useCallback(async (pwd) => {
    if (!pendingAction) return;
    try {
      const decrypted = await decryptWithPassword(pendingAction.data, pwd);
      setDecryptedText(decrypted);
      setMode('view');
      setShowPasswordDialog(false);
      setPendingAction(null);
      showToast('Loaded from URL – never stored.', 'info');
    } catch (err) {
      showToast('Wrong password.');
    }
  }, [pendingAction]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedUrl);
    showToast('Copied!', 'success');
  };

  const shortenUrl = async () => {
    if (!generatedUrl) return;
    setShortening(true);
    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(generatedUrl)}`);
      if (!res.ok) throw new Error();
      const short = await res.text();
      setGeneratedUrl(short);
      showToast('Shortened!', 'success');
    } catch {
      showToast('Shortening failed');
    } finally {
      setShortening(false);
    }
  };

  const resetToOriginal = () => {
    if (originalUrl) {
      setGeneratedUrl(originalUrl);
      showToast('Original URL restored', 'success');
    }
  };

  const newPaste = () => {
    setMode('create');
    setText('');
    setGeneratedUrl('');
    setOriginalUrl('');
    setDecryptedText('');
    setError('');
    setInfo('');
    setExpired(false);
    setExpiration('');
    window.location.hash = '';
  };

  return (
    <div className="container">
      <div className="header">
        <h1>
          <img src={ICONS.clipboard} alt="" className="header-icon" />
          Ephemeral Pastebin
        </h1>
        <p>Text lives only in the URL – optional password, compression, expiry. No server.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <span>{mode === 'create' ? 'New paste' : <><img src={ICONS.viewPaste} className="icon" alt="" /> View paste</>}</span>
        </div>
        <div className="card-content">
          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-success">{info}</div>}
          {expired && <div className="alert alert-error">This paste expired. <button className="btn btn-secondary" onClick={newPaste}>Create new</button></div>}

          {mode === 'create' && !expired && (
            <>
              <textarea className="paste-input" placeholder="Paste text, code, or secrets..." value={text} onChange={(e) => setText(e.target.value)} />

              <div className="expiry-selector">
                <select
                  className="expiry-select"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                >
                  <option value="">Never expire</option>
                  <option value="1h">Expires in 1 hour</option>
                  <option value="1d">Expires in 1 day</option>
                  <option value="7d">Expires in 7 days</option>
                </select>
              </div>

              <div className="btn-group">
                <button className="btn btn-primary" onClick={handleCreateClick}>
                  <img src={ICONS.link} className="icon" alt="" /> Get Encrypted Link
                </button>
              </div>

              {generatedUrl && (
                <div>
                  <div className="url-box">{generatedUrl}</div>
                  <div className="btn-group">
                    <button className="btn btn-primary" onClick={copyToClipboard}><img src={ICONS.copy} className="icon" alt="" /> Copy URL</button>
                    <button className="btn btn-secondary" onClick={shortenUrl}><img src={ICONS.link} className="icon" alt="" /> Shorten</button>
                    {originalUrl && generatedUrl !== originalUrl && <button className="btn btn-secondary" onClick={resetToOriginal}><img src={ICONS.refresh} className="icon" alt="" /> Show original</button>}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'view' && !expired && decryptedText && (
            <>
              {/* Removed the ugly alert-info box */}
              <textarea className="paste-input" readOnly value={decryptedText} />
              <div className="btn-group">
                <button className="btn btn-secondary" onClick={newPaste}>Create new paste</button>
                <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(decryptedText); showToast('Copied!', 'success'); }}><img src={ICONS.clipboard} className="icon" alt="" /> Copy text</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="footer">
        <p> Data lives only in the URL. Password = AES‑256. Expiry checked locally.</p>
      </div>

      {showPasswordChoiceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3><img src={ICONS.password} className="icon" alt="" /> Password Protection</h3>
            <p>Protect this paste with a password?</p>
            <label className="checkbox-label">
              <input type="checkbox" checked={shouldEncrypt} onChange={(e) => setShouldEncrypt(e.target.checked)} />
              Yes, require password
            </label>
            {shouldEncrypt && (
              <input
                type="password"
                placeholder="Enter password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                autoFocus
              />
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordChoiceModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePasswordChoiceConfirm}>Create Link</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h3><img src={ICONS.password} className="icon" alt="" /> Password required</h3>
            <p>This paste is encrypted. Enter password:</p>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDecrypt(password)}
              autoFocus
            />
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleDecrypt(password)}>Decrypt</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast.type === 'error' ? '⚠️ ' : toast.type === 'info' ? '📋 ' : '✓ '}
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
