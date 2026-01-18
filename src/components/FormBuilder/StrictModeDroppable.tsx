import { useEffect, useState } from 'react';
import { Droppable, DroppableProps } from 'react-beautiful-dnd';

/**
 * Wrapper for react-beautiful-dnd Droppable that works with React 18 Strict Mode.
 * 
 * React 18's Strict Mode double-mounts components in development, which causes
 * react-beautiful-dnd to fail to register the droppable properly.
 * 
 * This wrapper delays rendering the Droppable until after the first render cycle,
 * ensuring the component is properly mounted before the library tries to register it.
 */
export function StrictModeDroppable({ children, ...props }: DroppableProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Use requestAnimationFrame to delay enabling until after paint
    const animation = requestAnimationFrame(() => setEnabled(true));
    
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props}>{children}</Droppable>;
}
