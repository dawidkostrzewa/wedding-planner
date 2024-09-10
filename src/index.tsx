import React from 'react';
import ReactDOM from 'react-dom/client';
import GraphicalEditor from './GraphicalEditor';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <GraphicalEditor />
  </React.StrictMode>
);