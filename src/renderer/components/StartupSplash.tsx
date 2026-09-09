import React from 'react';
import './StartupSplash.css';

export type SplashStatus = 'starting' | 'restoring' | 'loadingFile';

interface StartupSplashProps {
  visible: boolean;
  fading: boolean;
  status: SplashStatus;
  statusLabel: string;
}

const StartupSplash: React.FC<StartupSplashProps> = ({
  visible,
  fading,
  status,
  statusLabel,
}) => {
  if (!visible) return null;

  return (
    <div
      className={`startup-splash${fading ? ' startup-splash--fade' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!fading}
      data-status={status}
    >
      <div className="startup-splash-card">
        <img
          className="startup-splash-logo"
          src="./LogStudio_Logo.png"
          alt="LogStudio"
          width={96}
          height={96}
          draggable={false}
        />
        <div className="startup-splash-brand">LogStudio</div>
        <div className="startup-splash-spinner" aria-hidden="true" />
        <p className="startup-splash-status">{statusLabel}</p>
      </div>
    </div>
  );
};

export default StartupSplash;
