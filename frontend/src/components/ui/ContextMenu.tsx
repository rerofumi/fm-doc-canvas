import React, { useEffect, useCallback } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  label?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, 
  y, 
  onClose, 
  onDelete,
  label = "Item"
}) => {
  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    onClose();
  }, [onDelete, onClose]);

  return (
    <div
      className="fixed z-[100] min-w-[160px] bg-white border border-gray-200 shadow-xl rounded-lg py-1 overflow-hidden animate-in fade-in zoom-in duration-100"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 border-b border-gray-50 mb-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
          {label} Options
        </span>
      </div>
      
      <button
        onClick={handleDeleteClick}
        className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="mr-2"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
        Delete {label}
      </button>

      <button
        onClick={onClose}
        className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors text-left"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="mr-2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        Cancel
      </button>
    </div>
  );
};

export default ContextMenu;
