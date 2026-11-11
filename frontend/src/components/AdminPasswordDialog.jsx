import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import './AdminPasswordDialog.css';

const AdminPasswordDialog = ({ error, onSubmit, onCancel }) => {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    const enteredPassword = password;
    setPassword('');
    onSubmit(enteredPassword);
  };

  return (
    <div className="step-up-backdrop">
      <section
        className="step-up-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-title"
        aria-describedby="step-up-description"
      >
        <div className="step-up-icon"><ShieldCheck size={22} aria-hidden="true" /></div>
        <h2 id="step-up-title">Admin password verification</h2>
        <p id="step-up-description">
          Enter an administrator password to authorize this change. Verification is required for each operation.
        </p>
        {error && <p className="step-up-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          <label htmlFor="step-up-password">Admin password</label>
          <div className="step-up-input-wrap">
            <input
              id="step-up-password"
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
              maxLength={256}
              required
              autoFocus
            />
            <button
              type="button"
              className="step-up-visibility"
              onClick={() => setVisible(value => !value)}
              aria-label={visible ? 'Hide Admin password' : 'Show Admin password'}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="step-up-actions">
            <button type="button" className="step-up-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className="step-up-confirm">Verify &amp; continue</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AdminPasswordDialog;
