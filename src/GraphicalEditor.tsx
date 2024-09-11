import React, { useState, useEffect, useRef } from 'react';
import Table from './Table';
import GuestImporter from './GuestImporter';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import styles from './GraphicalEditor.module.css';

interface GuestType {
  id: string;
  name: string;
  category: string;
  group?: string;
}

interface TableType {
  id: string;
  shape: 'rectangle' | 'circle';
  capacity: number;
  guests: { [position: string]: GuestType };
}

interface Variant {
  id: string;
  name: string;
  tables: TableType[];
  guestAssignments: { [tableId: string]: { [position: string]: string } };
}

const categories = [
  'guest-bride-family',
  'guest-groom-family',
  'guest-bride-friends',
  'guest-groom-friends',
  'guest-common-friends'
];

const GraphicalEditor: React.FC = () => {
  const [guests, setGuests] = useState<GuestType[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [newGuestNames, setNewGuestNames] = useState<{ [key: string]: string }>(
    categories.reduce((acc, category) => ({ ...acc, [category]: '' }), {})
  );
  const [newTableShape, setNewTableShape] = useState<'rectangle' | 'circle'>('rectangle');
  const [newTableCapacity, setNewTableCapacity] = useState(8);
  const [guestAssignments, setGuestAssignments] = useState<{ [tableId: string]: { [position: string]: string } }>({});
  const [editingGuest, setEditingGuest] = useState<string | null>(null);
  const [categorizedGuests, setCategorizedGuests] = useState<GuestType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState('');
  const [showGuestImporter, setShowGuestImporter] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGuestsFromLocalStorage();
    loadVariantNamesFromLocalStorage();
  }, []);

  useEffect(() => {
    if (guests.length > 0) {
      saveGuestsToLocalStorage();
    }
  }, [guests]);

  const loadGuestsFromLocalStorage = () => {
    const savedGuests = localStorage.getItem('weddingGuests');
    if (savedGuests) {
      const parsedGuests = JSON.parse(savedGuests);
      if (Array.isArray(parsedGuests) && parsedGuests.length > 0) {
        setGuests(parsedGuests);
        setCategorizedGuests(parsedGuests);
      }
    } 
  };

  const saveGuestsToLocalStorage = () => {
    localStorage.setItem('weddingGuests', JSON.stringify(guests));
  };

 

 

  const addTable = () => {
    let adjustedCapacity = newTableCapacity;
    if (newTableShape === 'rectangle') {
      adjustedCapacity = Math.max(2, Math.ceil(adjustedCapacity / 2) * 2);
    }
    const newTable: TableType = {
      id: Date.now().toString(),
      shape: newTableShape,
      capacity: adjustedCapacity,
      guests: {}, // Initialize with an empty object
    };
    setTables([...tables, newTable]);
  };

  const removeGuest = (guestId: string) => {
    setGuests(prevGuests => prevGuests.filter(guest => guest.id !== guestId));
    setCategorizedGuests(prevGuests => prevGuests.filter(guest => guest.id !== guestId));
    setGuestAssignments(prev => {
      const newAssignments = { ...prev };
      Object.keys(newAssignments).forEach(tableId => {
        Object.keys(newAssignments[tableId] || {}).forEach(pos => {
          if (newAssignments[tableId][pos] === guestId) {
            delete newAssignments[tableId][pos];
          }
        });
      });
      return newAssignments;
    });
  };

  const generatePositionName = (index: number): string => {
    return `seat-${index + 1}`;
  };

  const handleGuestAssignment = (tableId: string, guestId: string, position: string) => {
    setGuestAssignments(prev => {
      const newAssignments = { ...prev };
      
      // Remove guest from previous assignment
      Object.keys(newAssignments).forEach(tId => {
        Object.keys(newAssignments[tId] || {}).forEach(pos => {
          if (newAssignments[tId][pos] === guestId) {
            delete newAssignments[tId][pos];
          }
        });
      });

      // Assign guest to new position
      if (!newAssignments[tableId]) {
        newAssignments[tableId] = {};
      }
      newAssignments[tableId][position] = guestId;

      return newAssignments;
    });

    setTables(prevTables => {
      return prevTables.map(table => {
        if (table.id === tableId) {
          const updatedGuests = { ...table.guests };
          const guest = guests.find(g => g.id === guestId);
          if (guest) {
            updatedGuests[position] = guest;
          }
          return { ...table, guests: updatedGuests };
        }
        return table;
      });
    });
  };

  const getTableGuests = (tableId: string) => {
    const assignedGuests: { [position: string]: GuestType } = {};
    const tableAssignments = guestAssignments[tableId] || {};
    
    Object.entries(tableAssignments).forEach(([position, guestId]) => {
      const guest = guests.find(g => g.id === guestId);
      if (guest) {
        assignedGuests[position] = guest;
      }
    });

    return assignedGuests;
  };

  const getUnassignedGuests = () => {
    const assignedGuestIds = new Set(
      Object.values(guestAssignments).flatMap(tableAssignments => Object.values(tableAssignments))
    );
    return categorizedGuests.filter((guest) => !assignedGuestIds.has(guest.id));
  };



  const unassignGuest = (tableId: string, position: string) => {
    setTables(prevTables => {
      return prevTables.map(table => {
        if (table.id === tableId) {
          const updatedGuests = { ...table.guests };
          delete updatedGuests[position];
          return { ...table, guests: updatedGuests };
        }
        return table;
      });
    });

    setGuestAssignments(prevAssignments => {
      const updatedAssignments = { ...prevAssignments };
      if (updatedAssignments[tableId]) {
        delete updatedAssignments[tableId][position];
      }
      return updatedAssignments;
    });
  };

  const removeTable = (tableId: string) => {
    setTables(prevTables => prevTables.filter(table => table.id !== tableId));
    setGuestAssignments(prevAssignments => {
      const { [tableId]: removedTable, ...remainingAssignments } = prevAssignments;
      return remainingAssignments;
    });
  };

  const loadVariantNamesFromLocalStorage = () => {
    const savedVariantNames = localStorage.getItem('variantNames');
    if (savedVariantNames) {
      try {
        const variantNames = JSON.parse(savedVariantNames);
        if (Array.isArray(variantNames)) {
          setVariants(variantNames.map((name: string) => ({ 
            id: name, 
            name, 
            tables: [], 
            guestAssignments: {} 
          })));
        } else {
          console.error('Invalid variantNames format in localStorage');
          setVariants([]);
        }
      } catch (error) {
        console.error('Error parsing variantNames from localStorage:', error);
        setVariants([]);
      }
    } else {
      setVariants([]);
    }
  };

  const saveVariantToLocalStorage = (variant: Variant) => {
    localStorage.setItem(`variant_${variant.name}`, JSON.stringify(variant));
    setVariants(prevVariants => {
      const updatedVariants = [...prevVariants.filter(v => v.name !== variant.name), variant];
      localStorage.setItem('variantNames', JSON.stringify(updatedVariants.map(v => v.name)));
      return updatedVariants;
    });
  };

  const saveCurrentVariant = () => {
    if (newVariantName.trim()) {
      const newVariant: Variant = {
        id: newVariantName.trim(),
        name: newVariantName.trim(),
        tables: tables,
        guestAssignments: guestAssignments,
      };
      saveVariantToLocalStorage(newVariant);
      setNewVariantName('');
      setCurrentVariantId(newVariant.id);
    }
  };

  const loadVariant = (variantId: string) => {
    if (variantId === '') {
      // Clear tables and assignments when selecting the default option
      setTables([]);
      setGuestAssignments({});
      setCurrentVariantId(null);
    } else {
      const savedVariant = localStorage.getItem(`variant_${variantId}`);
      if (savedVariant) {
        const variant: Variant = JSON.parse(savedVariant);
        setTables(variant.tables);
        setGuestAssignments(variant.guestAssignments);
        setCurrentVariantId(variantId);
      }
    }
  };

  const exportVariant = () => {
    if (!currentVariantId) {
      alert("Please select a variant to export.");
      return;
    }

    const savedVariant = localStorage.getItem(`variant_${currentVariantId}`);
    if (!savedVariant) {
      alert("Selected variant not found.");
      return;
    }

    const variant: Variant = JSON.parse(savedVariant);
    const dataStr = JSON.stringify(variant);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${variant.name.replace(/\s+/g, '_')}_variant.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importVariant = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedVariant: Variant = JSON.parse(content);
        
        // Validate the imported data structure
        if (!importedVariant.id || !importedVariant.name || !importedVariant.tables || !importedVariant.guestAssignments) {
          throw new Error("Invalid variant structure");
        }

        // Save the imported variant
        saveVariantToLocalStorage(importedVariant);

        // Load the imported variant
        setTables(importedVariant.tables);
        setGuestAssignments(importedVariant.guestAssignments);
        setCurrentVariantId(importedVariant.id);

        alert("Variant imported successfully!");
      } catch (error) {
        console.error("Error importing variant:", error);
        alert("Error importing variant. Please check the file format.");
      }
    };
    reader.readAsText(file);
  };

  const importGuests = (category: string, newGuests: string[]) => {
    const processedGuests = newGuests.flatMap(line => 
      line.split(';').map(name => name.trim()).filter(name => name !== '')
    );

    const newGuestObjects = processedGuests.map(name => ({
      id: `${category}_${name.replace(/\s+/g, '_').toLowerCase()}`,
      name,
      category,
    }));

    setGuests(prevGuests => [...prevGuests, ...newGuestObjects]);
    setCategorizedGuests(prevCategorized => [...prevCategorized, ...newGuestObjects]);
  };

  const addGuestToCategory = (category: string) => {
    if (newGuestNames[category].trim()) {
      const newGuest: GuestType = { 
        id: uuidv4(),
        name: newGuestNames[category].trim(),
        category: category,
      };
      setGuests(prevGuests => [...prevGuests, newGuest]);
      setCategorizedGuests(prevGuests => [...prevGuests, newGuest]);
      setNewGuestNames(prev => ({ ...prev, [category]: '' }));
    }
  };

  return (
    <div className={styles.graphicalEditor}>
      <h1 className={styles.title}>Wedding Planner</h1>
      <div className={styles.controls}>
        <div className={styles.tableControls}>
          <select
            value={newTableShape}
            onChange={(e) => setNewTableShape(e.target.value as 'rectangle' | 'circle')}
            className={styles.input}
          >
            <option value="rectangle">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <input
            type="number"
            value={newTableCapacity}
            onChange={(e) => setNewTableCapacity(parseInt(e.target.value))}
            min="1"
            className={styles.input}
          />
          <button onClick={addTable} className={styles.button}>Add Table</button>
        </div>
        <div className={styles.variantControls}>
          <input
            type="text"
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
            placeholder="Variant name"
            className={styles.input}
          />
          <button onClick={saveCurrentVariant} className={styles.button}>Save Current Variant</button>
          <select
            value={currentVariantId || ''}
            onChange={(e) => loadVariant(e.target.value)}
            className={styles.input}
          >
            <option value="">Select a variant (or clear tables)</option>
            {variants.map(variant => (
              <option key={variant.id} value={variant.id}>{variant.name}</option>
            ))}
          </select>
          <button onClick={exportVariant} className={styles.button}>Export Variant</button>
          <input
            type="file"
            accept=".json"
            onChange={importVariant}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          <button onClick={() => fileInputRef.current?.click()} className={styles.button}>
            Import Variant
          </button>
          <button onClick={() => setShowGuestImporter(!showGuestImporter)} className={styles.button}>
            {showGuestImporter ? 'Hide Guest Importer' : 'Show Guest Importer'}
          </button>
        </div>
      </div>
      {showGuestImporter && (
        <div className={styles.guestImporterContainer}>
          {categories.map(category => (
            <GuestImporter
              key={category}
              category={category.replace('guest-', '').replace('-', ' ')}
              onImport={(guests) => importGuests(category, guests)}
            />
          ))}
        </div>
      )}
      <div className={styles.editorArea}>
        <div className={styles.guestList}>
          {categories.map(category => (
            <div key={category} className={styles.guestCategory}>
              <h3 className={styles.guestCategoryTitle}>{category.replace('guest-', '').replace('-', ' ')}</h3>
              <div className={styles.categoryAddGuest}>
                <input
                  type="text"
                  value={newGuestNames[category]}
                  onChange={(e) => setNewGuestNames(prev => ({ ...prev, [category]: e.target.value }))}
                  placeholder="Guest name"
                  className={styles.input}
                />
                <button 
                  onClick={() => addGuestToCategory(category)} 
                  className={styles.button}
                >
                  Add Guest
                </button>
              </div>
              {getUnassignedGuests()
                .filter(guest => guest.category === category)
                .map((guest) => (
                  <div 
                    key={guest.id} 
                    className={`${styles.guestItem} ${styles[`guest${guest.category.split('-')[1].charAt(0).toUpperCase() + guest.category.split('-')[1].slice(1)}${guest.category.split('-')[2].charAt(0).toUpperCase() + guest.category.split('-')[2].slice(1)}`]}`} 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('text', `new-guest|${guest.id}`)}
                  >
                    <span>{guest.name}</span>
                    <button onClick={() => removeGuest(guest.id)}>X</button>
                  </div>
                ))}
            </div>
          ))}
        </div>
        <div className={styles.tableSection}>
          <div className={styles.tableGrid}>
            {tables.map((table) => (
              <div key={table.id} className={styles.tableWrapper}>
                <Table
                  {...table}
                  guests={getTableGuests(table.id)}
                  onDrop={handleGuestAssignment}
                  onUnassign={unassignGuest}
                  onEdit={() => {}}
                  updatePosition={() => {}}
                />
                <button 
                  className={`${styles.button} ${styles.removeTableButton}`}
                  onClick={() => removeTable(table.id)}
                >
                  Remove Table
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphicalEditor;