import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/I18nProvider';

const root = document.getElementById('root')!;
createRoot(root).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
