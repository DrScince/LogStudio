import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import './AiInstallChoice.css';

interface AiInstallChoiceProps {
  onChoose: (aiEnabled: boolean) => void | Promise<void>;
}

const AiInstallChoice: React.FC<AiInstallChoiceProps> = ({ onChoose }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const choose = async (aiEnabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await onChoose(aiEnabled);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-choice-overlay" role="dialog" aria-modal="true" aria-labelledby="ai-choice-title">
      <div className="ai-choice-modal">
        <h2 id="ai-choice-title">{t('ai.installChoiceTitle')}</h2>
        <p className="ai-choice-lead">{t('ai.installChoiceLead')}</p>
        <div className="ai-choice-options">
          <button
            type="button"
            className="ai-choice-option"
            disabled={busy}
            onClick={() => void choose(false)}
          >
            <span className="ai-choice-option-title">{t('ai.installChoiceWithout')}</span>
            <span className="ai-choice-option-desc">{t('ai.installChoiceWithoutDesc')}</span>
          </button>
          <button
            type="button"
            className="ai-choice-option primary"
            disabled={busy}
            onClick={() => void choose(true)}
          >
            <span className="ai-choice-option-title">{t('ai.installChoiceWith')}</span>
            <span className="ai-choice-option-desc">{t('ai.installChoiceWithDesc')}</span>
          </button>
        </div>
        {busy && <p className="ai-choice-busy">{t('ai.installChoiceWorking')}</p>}
      </div>
    </div>
  );
};

export default AiInstallChoice;
