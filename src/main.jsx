// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

// Aplicar tema guardado antes de renderizar
try {
  const saved = JSON.parse(localStorage.getItem('inmogest-theme') || '{}');
  const theme = saved?.state?.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
} catch(e) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:                1,
      refetchOnWindowFocus: false,
      staleTime:            30 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background:   '#1e293b',
            color:        '#f1f5f9',
            border:       '1px solid #334155',
            borderRadius: '10px',
            fontSize:     '14px',
          },
          success: { iconTheme: { primary:'#10b981', secondary:'#f1f5f9' } },
          error:   { iconTheme: { primary:'#ef4444', secondary:'#f1f5f9' }, duration:5000 },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);