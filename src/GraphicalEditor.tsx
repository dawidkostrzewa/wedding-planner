import React, { useState, useEffect, useRef } from 'react';
import Table from './Table';
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

const GraphicalEditor: React.FC = () => {
  const [guests, setGuests] = useState<GuestType[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [newTableShape, setNewTableShape] = useState<'rectangle' | 'circle'>('rectangle');
  const [newTableCapacity, setNewTableCapacity] = useState(8);
  const [guestAssignments, setGuestAssignments] = useState<{ [tableId: string]: { [position: string]: string } }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGuest, setEditingGuest] = useState<string | null>(null);
  const [categorizedGuests, setCategorizedGuests] = useState<GuestType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGuestsFromFiles();
    loadVariantNamesFromLocalStorage();
  }, []);

  const loadGuestsFromFiles = async () => {
    const categories = [
      'guest-bride-family',
      'guest-groom-family',
      'guest-bride-friends',
      'guest-groom-friends',
      'guest-common-friends'
    ];
    let allGuests: GuestType[] = [];
    let groupCounter = 0;

    for (const category of categories) {
      try {
        const response = await fetch(`/data/${category}.txt`);
        const text = await response.text();
        const lines = text.split(/[\n;]/).map(line => line.trim()).filter(line => line !== '');

        lines.forEach(line => {
          const names = line.split(';')
          console.log(names);
          if (names.length > 1) {
            groupCounter++;
            const currentGroup = `group_${groupCounter}`;
            names.forEach(name => {
              allGuests.push({
                id: `${category}_${name.replace(/\s+/g, '_').toLowerCase()}`,
                name,
                category,
                group: currentGroup
              });
            });
          } else {
            allGuests.push({
              id: `${category}_${names[0].replace(/\s+/g, '_').toLowerCase()}`,
              name: names[0],
              category
            });
          }
        });
      } catch (error) {
        console.error(`Error loading ${category} guests:`, error);
      }
    }
    console.log(allGuests);
    setCategorizedGuests(allGuests);
    setGuests(allGuests);
  };

  const createTablesForGuests = () => {
    const totalGuests = categorizedGuests.length;
    let remainingGuests = totalGuests;
    const newTables: TableType[] = [];

    let tableCounter = 0;
    while (remainingGuests > 0) {
      if (remainingGuests >= 16) {
        // Create a rectangular table for 16-20 guests
        newTables.push({
          id: `table_${tableCounter}`,
          shape: 'rectangle',
          capacity: 20,
          guests: {},
        });
        remainingGuests -= 20;
      } else if (remainingGuests >= 6) {
        // Create a circular table for 6-8 guests
        newTables.push({
          id: `table_${tableCounter}`,
          shape: 'circle',
          capacity: 8,
          guests: {},
        });
        remainingGuests -= 8;
      } else {
        // Create a small circular table for remaining guests
        newTables.push({
          id: `table_${tableCounter}`,
          shape: 'circle',
          capacity: remainingGuests,
          guests: {},
        });
        remainingGuests = 0;
      }
      tableCounter++;
    }

    setTables(newTables);
  };

  const addGuest = () => {
    if (newGuestName.trim()) {
      const newGuest: GuestType = { 
        id: Date.now().toString(),
        name: newGuestName.trim(),
        category: 'guest-common-friends', // Add a default category
      };
      setGuests([...guests, newGuest]);
      setNewGuestName('');
    }
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
    setGuests(guests.filter(guest => guest.id !== guestId));
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

  const editGuestName = (guestId: string, newName: string) => {
    setGuests(guests.map(guest => 
      guest.id === guestId ? { ...guest, name: newName } : guest
    ));
    setEditingGuest(null);
  };

  const autoAssignGuests = async () => {
    setIsLoading(true);
    const unassignedGuests = getUnassignedGuests();

    const guestData = unassignedGuests.map(guest => ({
      id: guest.id,
      name: guest.name,
      category: guest.category,
      group: guest.group,
    }));

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates seating arrangements and assigns guests to tables. Respond with a JSON object containing two properties: 'tables' (an array of table objects) and 'assignments' (an object with table IDs as keys and arrays of guest IDs as values)."
          },
          {
            role: "user",
            content: `Generate a seating arrangement for ${unassignedGuests.length} guests and assign ALL of them to tables. Each table object should have 'id', 'shape' (either 'circle' or 'rectangle'), and 'capacity' properties. Follow these rules strictly:
            1. Circle tables have a maximum of 8 seats, rectangle tables have a maximum of 20 seats.
            2. Create enough tables to seat ALL guests. No guest should be left unassigned.
            3. Keep guests from the same group together if possible.
            4. Try to seat guests from the same category together when feasible.
            5. Friends from bride, groom, and common categories can sit together.
            6. Maximize table utilization, but prioritize keeping groups and categories together over full table utilization.
            7. IMPORTANT: Ensure that the total number of assigned guests matches the total number of input guests.
            8. IMPORTANT: Make sure that one person is not assigned to multiple tables.

            Guests: ${JSON.stringify(guestData)}

            Return the table layout and guest assignments. Double-check that all guests are assigned before returning the result.`
          }
        ],
        temperature: 0.7,
      }, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const aiMessage = response.data.choices[0].message.content;
      console.log("AI Message:", aiMessage);

      // Extract JSON from the code block
      const jsonMatch = aiMessage.match(/```json\n([\s\S]*)\n```/) || aiMessage.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Couldn't extract JSON from AI response");
      }

      const aiResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      console.log("Parsed AI Response:", aiResponse);

      // Verify that all guests are assigned
      const assignedGuestCount = Object.values(aiResponse.assignments).flat().length;
    //   if (assignedGuestCount !== unassignedGuests.length) {
    //     throw new Error(`Not all guests were assigned. Expected ${unassignedGuests.length}, but got ${assignedGuestCount}`);
    //   }

      // Create new tables based on AI response
      const newTables: TableType[] = aiResponse.tables.map((table: any) => ({
        id: table.id.toString(),
        shape: table.shape as 'rectangle' | 'circle',
        capacity: table.capacity,
        guests: {},
      }));

      // Create new guest assignments based on AI response
      const newGuestAssignments: { [tableId: string]: { [position: string]: string } } = {};
      Object.entries(aiResponse.assignments).forEach(([tableId, guestIds]) => {
        newGuestAssignments[tableId] = {};
        (guestIds as string[]).forEach((guestId, index) => {
          const positionName = generatePositionName(index);
          newGuestAssignments[tableId][positionName] = guestId;
        });
      });

      // Update tables with assigned guests
      const updatedTables = newTables.map(table => ({
        ...table,
        guests: Object.entries(newGuestAssignments[table.id] || {}).reduce((acc, [position, guestId]) => {
          const guest = guests.find(g => g.id === guestId);
          if (guest) {
            acc[position] = guest;
          }
          return acc;
        }, {} as { [position: string]: GuestType })
      }));

      // Update state with new tables and assignments
      setTables(updatedTables);
      setGuestAssignments(newGuestAssignments);

      console.log("Updated Tables:", updatedTables);
      console.log("Updated Guest Assignments:", newGuestAssignments);

    } catch (error) {
      console.error('Error assigning guests and creating tables:', error);
    } finally {
      setIsLoading(false);
    }
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
      const variantNames = JSON.parse(savedVariantNames);
      setVariants(variantNames.map((name: string) => ({ id: name, name })));
    }
  };

  const saveVariantToLocalStorage = (variant: Variant) => {
    localStorage.setItem(`variant_${variant.name}`, JSON.stringify(variant));
    const updatedVariants = [...variants, { id: variant.name, name: variant.name }];
    setVariants(updatedVariants);
    localStorage.setItem('variantNames', JSON.stringify(updatedVariants.map(v => v.name)));
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

  const categories = [
    'guest-bride-family',
    'guest-groom-family',
    'guest-bride-friends',
    'guest-groom-friends',
    'guest-common-friends'
  ];

  return (
    <div className={styles.graphicalEditor}>
      <h1 className={styles.title}>Wedding Planner</h1>
      <div className={styles.controls}>
        <div className={styles.guestControls}>
          <input
            type="text"
            value={newGuestName}
            onChange={(e) => setNewGuestName(e.target.value)}
            placeholder="Guest name"
            className={styles.input}
          />
          <button onClick={addGuest} className={styles.button}>Add Guest</button>
        </div>
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
        </div>
      </div>
      <div className={styles.editorArea}>
        <div className={styles.guestList}>
          {categories.map(category => (
            <div key={category} className={styles.guestCategory}>
              <h3 className={styles.guestCategoryTitle}>{category.replace('guest-', '').replace('-', ' ')}</h3>
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
      <div className={styles.autoAssignButton}>
        <button onClick={autoAssignGuests} disabled={isLoading} className={styles.button}>
          {isLoading ? 'Processing...' : 'Auto Assign Guests and Create Tables'}
        </button>
      </div>
    </div>
  );
};

export default GraphicalEditor;