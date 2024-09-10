import React from 'react';
import styles from './Table.module.css';

interface GuestType {
  id: string;
  name: string;
  category: string;
  group?: string;
}

interface TableProps {
  shape: 'rectangle' | 'circle';
  id: string;
  capacity: number;
  guests: { [position: string]: GuestType };
  onDrop: (tableId: string, guestId: string, position: string) => void;
  onUnassign: (tableId: string, position: string) => void;
  onEdit: () => void;
  updatePosition: (row: number, col: number) => void;
}

const Table: React.FC<TableProps> = ({ shape, capacity, guests, id, onDrop, onUnassign }) => {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, position: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text');
    const [sourceType, guestId, sourceTableId, sourcePosition] = data.split('|');

    if (sourceType === 'new-guest') {
      onDrop(id, guestId, position);
    } else if (sourceType === 'existing-guest') {
      if (sourceTableId === id) {
        // Move within the same table
        onDrop(id, guestId, position);
      } else {
        // Move from another table
        onDrop(id, guestId, position);
      }
    }
  };

  const handleGuestDragStart = (e: React.DragEvent<HTMLDivElement>, guestId: string, position: string) => {
    e.dataTransfer.setData('text', `existing-guest|${guestId}|${id}|${position}`);
  };

  const handleGuestClick = (position: string) => {
    onUnassign(id, position);
  };

  const getSeatPositions = () => {
    return Array.from({ length: capacity }, (_, i) => `seat-${i + 1}`);
  };

  const seatPositions = getSeatPositions();

  const getCirclePosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = 40;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  };

  const getRectanglePosition = (index: number, total: number) => {
    const isTop = index < total / 2;
    const sideIndex = isTop ? index : index - Math.floor(total / 2);
    const sideTotal = Math.ceil(total / 2);
    const x = 10 + (sideIndex / (sideTotal - 1)) * 80;
    const y = isTop ? 10 : 90;
    return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableInfo}>
        <span>{shape} Table</span>
        <span>Capacity: {capacity}</span>
        <span>Seated: {Object.keys(guests).length}</span>
      </div>
      <div 
        className={`${styles.table} ${styles[shape]}`}
        onDragOver={handleDragOver}
      >
        <div className={`${styles.tableSurface} ${styles[shape]}`}></div>
        {getSeatPositions().map((position, index) => {
          const seatStyle = shape === 'circle' 
            ? getCirclePosition(index, capacity)
            : getRectanglePosition(index, capacity);
          
          const guest = guests[position];
          return (
            <div
              key={position}
              className={styles.seat}
              style={seatStyle}
              onDrop={(e) => handleDrop(e, position)}
              onDragOver={handleDragOver}
              onClick={() => handleGuestClick(position)}
            >
              {guest ? (
                <div 
                  className={`${styles.guest} ${styles[`guest${guest.category.split('-')[1].charAt(0).toUpperCase() + guest.category.split('-')[1].slice(1)}${guest.category.split('-')[2].charAt(0).toUpperCase() + guest.category.split('-')[2].slice(1)}`]}`}
                  title={guest.name}
                  draggable
                  onDragStart={(e) => handleGuestDragStart(e, guest.id, position)}
                >
                  {guest.name}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Table;