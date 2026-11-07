import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';

export function DataExportMenu() {
  const menuRef = useRef(null);
  const { setShowMenu, showMenu } = useWorkspaceView();
  const {
    exportWorkbook,
    uploadRef,
    downloadFullBackup,
    restoreRef,
    downloadRaw,
    clearDemo,
    restoreDemo,
  } = useWorkspaceActions();
  const options = [
    ['download', 'Export 17-sheet Excel', exportWorkbook],
    ['upload', 'Import Excel workbook', () => uploadRef.current?.click()],
    ['download', 'Full backup with photos (JSON)', downloadFullBackup],
    ['upload', 'Restore full backup (JSON)', () => restoreRef.current?.click()],
    ['note', 'Original Excel template', downloadRaw],
    ['plus', 'Start with blank CRM', clearDemo],
    ['sparkle', 'Restore sample records', restoreDemo],
  ];
  useEffect(() => {
    if (!showMenu) return;
    menuRef.current?.querySelector('.dropdown button')?.focus();
    const outside = (event) => {
      if (!menuRef.current?.contains(event.target)) setShowMenu(false);
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setShowMenu(false);
      menuRef.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [showMenu, setShowMenu]);
  return (
    <div className="menu-anchor" ref={menuRef}>
      <Button
        variant="light"
        icon="download"
        aria-expanded={showMenu}
        aria-controls="data-export-options"
        onClick={() => setShowMenu(!showMenu)}
      >
        Data & export <Icon name="down" size={14} />
      </Button>
      {showMenu && (
        <div className="dropdown" id="data-export-options" aria-label="Data and export options">
          {options.map(([icon, label, action], index) => (
            <React.Fragment key={label}>
              {index === 5 && <div className="dropdown-divider" />}
              <button
                type="button"
                onClick={() => {
                  action();
                  setShowMenu(false);
                }}
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
