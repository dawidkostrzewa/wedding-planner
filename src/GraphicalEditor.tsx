import React, { useState, useEffect } from 'react';
import Table from './Table';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

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

  useEffect(() => {
    loadGuestsFromFiles();
    loadVariantsFromLocalStorage();
  }, []);

//   useEffect(() => {
//     if (categorizedGuests.length > 0) {
//       createTablesForGuests();
//     }
//   }, [categorizedGuests]);

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
    const newAssignments = { ...guestAssignments };
    const table = tables.find(t => t.id === tableId);
    
    if (!table) return;

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

    setGuestAssignments(newAssignments);

    setTables(prevTables => {
      const updatedTables = prevTables.map(table => ({
        ...table,
        guests: Object.entries(newAssignments[table.id] || {}).reduce((acc, [pos, gId]) => {
          const guest = guests.find(g => g.id === gId);
          if (guest) {
            acc[pos] = guest;
          }
          return acc;
        }, {} as { [position: string]: GuestType })
      }));
      return updatedTables;
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
    // Remove the table from the tables array
    setTables(prevTables => prevTables.filter(table => table.id !== tableId));

    // Remove the table's assignments from guestAssignments
    setGuestAssignments(prevAssignments => {
      const { [tableId]: removedTable, ...remainingAssignments } = prevAssignments;
      return remainingAssignments;
    });
  };

  const loadVariantsFromLocalStorage = () => {
    const savedVariants = localStorage.getItem('tableAssignmentVariants');
    if (savedVariants) {
      setVariants(JSON.parse(savedVariants));
    }
  };

  const saveVariantToLocalStorage = (variant: Variant) => {
    const updatedVariants = [...variants, variant];
    setVariants(updatedVariants);
    localStorage.setItem('tableAssignmentVariants', JSON.stringify(updatedVariants));
  };

  const saveCurrentVariant = () => {
    if (newVariantName.trim()) {
      const newVariant: Variant = {
        id: uuidv4(),
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
      const variant = variants.find(v => v.id === variantId);
      if (variant) {
        setTables(variant.tables);
        setGuestAssignments(variant.guestAssignments);
        setCurrentVariantId(variantId);
      }
    }
  };

  const deleteVariant = (variantId: string) => {
    const updatedVariants = variants.filter(v => v.id !== variantId);
    setVariants(updatedVariants);
    localStorage.setItem('tableAssignmentVariants', JSON.stringify(updatedVariants));
    if (currentVariantId === variantId) {
      setCurrentVariantId(null);
    }
  };

  const categories = [
    'guest-bride-family',
    'guest-groom-family',
    'guest-bride-friends',
    'guest-groom-friends',
    'guest-common-friends'
  ];

  return (
    <div className="graphical-editor" style={{ color: 'white', padding: '20px' }}>
      <h1>Wedding Planner</h1>
      <div className="controls">
        <div className="guest-controls">
          <input
            type="text"
            value={newGuestName}
            onChange={(e) => setNewGuestName(e.target.value)}
            placeholder="Guest name"
          />
          <button onClick={addGuest}>Add Guest</button>

          {/* Variant controls */}
      <div className="variant-controls" style={{ marginTop: '20px' }}>
        <input
          type="text"
          value={newVariantName}
          onChange={(e) => setNewVariantName(e.target.value)}
          placeholder="Variant name"
        />
        <button onClick={saveCurrentVariant}>Save Current Variant</button>
        <select
          value={currentVariantId || ''}
          onChange={(e) => loadVariant(e.target.value)}
        >
          <option value="">Select a variant (or clear tables)</option>
          {variants.map(variant => (
            <option key={variant.id} value={variant.id}>{variant.name}</option>
          ))}
        </select>
        {currentVariantId && (
          <button onClick={() => deleteVariant(currentVariantId)}>Delete Current Variant</button>
        )}
      </div>
        </div>
        <div className="table-controls">
          <select
            value={newTableShape}
            onChange={(e) => setNewTableShape(e.target.value as 'rectangle' | 'circle')}
          >
            <option value="rectangle">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <input
            type="number"
            value={newTableCapacity}
            onChange={(e) => setNewTableCapacity(parseInt(e.target.value))}
            min="1"
          />
          <button onClick={addTable}>Add Table</button>
        </div>
      </div>
      <div className="search-controls">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search guests"
        />
      </div>
      <div className="editor-area" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* Guest List */}
        <div className="guest-list" style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)'}}>
          {categories.map(category => (
            <div key={category} style={{ flex: '1 0 18%', minWidth: '150px' }}>
              <h3>{category.replace('guest-', '').replace('-', ' ')}</h3>
              <div >
                {getUnassignedGuests()
                  .filter(guest => guest.category === category && guest.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((guest) => (
                    <div key={guest.id} className="guest-item" style={{ marginBottom: '5px' }}>
                      {editingGuest === guest.id ? (
                        <input
                          value={guest.name}
                          onChange={(e) => editGuestName(guest.id, e.target.value)}
                          onBlur={() => setEditingGuest(null)}
                          autoFocus
                        />
                      ) : (
                        <div
                          className={`guest-item-list ${guest.category}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text', `new-guest|${guest.id}`);
                          }}
                          onDoubleClick={() => setEditingGuest(guest.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span>{guest.name}</span>
                          <button 
                            onClick={() => removeGuest(guest.id)} 
                            style={{ 
                              fontSize: '0.8em', 
                              padding: '2px 5px', 
                              marginLeft: '5px',
                              background: 'red',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            X
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tables Section */}
        <div className="table-section" style={{ flex: '1', maxHeight: '80vh', overflowY: 'auto' }}>
          <div className="table-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {tables.map((table) => (
              <div key={table.id} style={{ position: 'relative' }}>
                <Table
                  {...table}
                  guests={getTableGuests(table.id)}
                  onDrop={handleGuestAssignment}
                  onUnassign={unassignGuest}
                  onEdit={() => {}}
                  updatePosition={() => {}}
                />
                <button 
                  onClick={() => removeTable(table.id)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'red',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '5px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Remove Table
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button onClick={autoAssignGuests} disabled={isLoading} style={{ marginTop: '20px' }}>
        {isLoading ? 'Processing...' : 'Auto Assign Guests and Create Tables'}
      </button>
      
      
    </div>
  );
};

export default GraphicalEditor;