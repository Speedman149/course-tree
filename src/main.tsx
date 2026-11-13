import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App';
import '@xyflow/react/dist/style.css';
import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-500.css';
import '@fontsource/heebo/hebrew-600.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/hebrew-800.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-500.css';
import '@fontsource/heebo/latin-600.css';
import '@fontsource/heebo/latin-700.css';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ReactFlowProvider><App /></ReactFlowProvider></React.StrictMode>,
);
