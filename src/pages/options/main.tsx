import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@/pages/ui/toast';
import '@/pages/ui/styles.css';
import { OptionsApp } from '@/pages/options/optionsApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <OptionsApp />
    </ToastProvider>
  </React.StrictMode>
);
