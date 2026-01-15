import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@/pages/ui/toast';
import '@/pages/ui/styles.css';
import { PopupApp } from '@/pages/popup/popupApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <PopupApp />
    </ToastProvider>
  </React.StrictMode>
);

