import React, { useState } from 'react';
import styles from './GraphicalEditor.module.css';

interface GuestImporterProps {
  category: string;
  onImport: (guests: string[]) => void;
}

const GuestImporter: React.FC<GuestImporterProps> = ({ category, onImport }) => {
  const [textAreaContent, setTextAreaContent] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTextAreaContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    const guests = textAreaContent.split('\n').map(line => line.trim()).filter(line => line !== '');
    onImport(guests);
    setTextAreaContent('');
  };

  return (
    <div className={styles.guestImporter}>
      <h4>{category}</h4>
      <input type="file" onChange={handleFileUpload} accept=".txt" />
      <textarea
        value={textAreaContent}
        onChange={(e) => setTextAreaContent(e.target.value)}
        placeholder="Enter guest names, one per line or separated by semicolons"
        rows={5}
      />
      <button onClick={handleImport} className={styles.button}>Import Guests</button>
    </div>
  );
};

export default GuestImporter;