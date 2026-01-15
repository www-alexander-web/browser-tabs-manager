import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@/pages/ui/toast';
import '@/pages/ui/styles.css';
import { ManagerApp } from '@/pages/manager/managerApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ManagerApp />
    </ToastProvider>
  </React.StrictMode>
);
