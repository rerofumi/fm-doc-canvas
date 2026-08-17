import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import App from './App'
import { LocaleProvider } from './i18n/LocaleProvider'
import { initI18n } from './i18n/i18n'
import { readLocalePreference, resolveEffectiveLocale } from './i18n/localePreference'

const container = document.getElementById('root');

const bootstrap = async () => {
  if (!container) return;
  const preference = readLocalePreference();
  const effectiveLocale = resolveEffectiveLocale(preference);
  await initI18n(effectiveLocale);
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <LocaleProvider initialPreference={preference}>
        <App />
      </LocaleProvider>
    </React.StrictMode>,
  );
};

void bootstrap();
