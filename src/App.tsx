import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppStatus {
  goal: string;
  status: string;
  next: string;
}

interface AppItem {
  id: string;
  name: string;
  mainUrl: string;
  externalUrl?: string;
  status: AppStatus;
}

export default function App() {
  const [apps, setApps] = useState<AppItem[]>(() => {
    try {
      const saved = localStorage.getItem('ai-design-hub-apps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load apps from localStorage:', e);
    }
    
    // Initial Sample Data
    return [
      {
        id: 'sample-1',
        name: 'app1',
        mainUrl: 'https://google.com',
        status: { goal: 'Sample Goal', status: 'In Progress', next: 'Finish UI' }
      }
    ];
  });

  useEffect(() => {
    console.log('Design Hub mounted. Apps count:', apps.length);
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [statusModalAppId, setStatusModalAppId] = useState<string | null>(null);
  
  // Add Modal State
  const [newName, setNewName] = useState('');
  const [newMainUrl, setNewMainUrl] = useState('');
  const [newExternalUrl, setNewExternalUrl] = useState('');

  // Status Modal Edit State
  const [editingField, setEditingField] = useState<'goal' | 'status' | 'next' | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    localStorage.setItem('ai-design-hub-apps', JSON.stringify(apps));
  }, [apps]);

  const handleAddApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMainUrl) return;

    const newApp: AppItem = {
      id: crypto.randomUUID(),
      name: newName || `app${apps.length + 1}`,
      mainUrl: newMainUrl.startsWith('http') ? newMainUrl : `https://${newMainUrl}`,
      externalUrl: newExternalUrl ? (newExternalUrl.startsWith('http') ? newExternalUrl : `https://${newExternalUrl}`) : undefined,
      status: {
        goal: 'Set your goal here',
        status: 'Current progress',
        next: 'Next steps',
      }
    };

    setApps([...apps, newApp]);
    setIsAddModalOpen(false);
    setNewName('');
    setNewMainUrl('');
    setNewExternalUrl('');
  };

  const handleDeleteApp = (id: string) => {
    setApps(apps.filter(app => app.id !== id));
  };

  const handleUpdateStatus = (id: string, field: keyof AppStatus, value: string) => {
    setApps(apps.map(app => 
      app.id === id ? { ...app, status: { ...app.status, [field]: value } } : app
    ));
    setEditingField(null);
  };

  const selectedApp = apps.find(app => app.id === statusModalAppId);

  return (
    <div className="min-h-screen bg-[#EEEEEE] p-8 font-pretendard text-[#6F6F6F]">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-16 mt-8">
        <h1 className="text-2xl md:text-3xl text-center leading-tight font-nunito italic font-bold text-[#001F3F]">
          hospitality <span className="text-[#20A200]">&</span> interior dept.<br />
          design hub
        </h1>
      </header>

      {/* App Grid */}
      <main className="max-w-4xl mx-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-x-4 gap-y-10">
        {apps.map((app) => (
          <AppCard 
            key={app.id} 
            app={app} 
            onDelete={() => handleDeleteApp(app.id)}
            onShowStatus={() => setStatusModalAppId(app.id)}
          />
        ))}

        {/* Add Button Card */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] opacity-0">spacer</span>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-12 h-12 neumorph-card rounded-xl flex items-center justify-center hover:neumorph-inset transition-all group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform text-[#001F3F]" />
          </button>
        </div>
      </main>

      {/* Add App Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Modal onClose={() => setIsAddModalOpen(false)}>
            <div className="p-6">
              <h2 className="text-lg mb-6 font-bold text-[#001F3F]">Add New App</h2>
              <form onSubmit={handleAddApp} className="space-y-4">
                <div>
                  <label className="block text-xs mb-1 font-medium">App Name</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. app1"
                    className="w-full p-2 text-sm neumorph-inset rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium">Main URL (Required)</label>
                  <input 
                    required
                    type="text" 
                    value={newMainUrl}
                    onChange={(e) => setNewMainUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 text-sm neumorph-inset rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium">External Workspaces URL</label>
                  <input 
                    type="text" 
                    value={newExternalUrl}
                    onChange={(e) => setNewExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 text-sm neumorph-inset rounded-lg focus:outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-2 bg-[#001F3F] text-white rounded-lg hover:bg-opacity-90 transition-colors mt-4 text-sm font-bold"
                >
                  Create App
                </button>
              </form>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Status Modal */}
      <AnimatePresence>
        {selectedApp && (
          <Modal onClose={() => setStatusModalAppId(null)} glass={true} disableOutsideClick={true}>
            <div className="p-8 min-w-[300px] md:min-w-[500px]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-[#001F3F]">Current Status</h2>
              </div>
              
              <div className="space-y-6">
                {(['goal', 'status', 'next'] as const).map((field) => (
                  <div key={field} className="ml-4">
                    <h3 className="text-sm font-bold capitalize mb-1 text-[#001F3F]">{field}</h3>
                    {editingField === field ? (
                      <div className="flex gap-3 items-center">
                        <input 
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 p-1 text-sm border-b border-[#001F3F] focus:outline-none bg-transparent"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateStatus(selectedApp.id, field, editValue);
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                        />
                        <button 
                          onClick={() => handleUpdateStatus(selectedApp.id, field, editValue)}
                          className="text-xs text-[#20A200] hover:underline"
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setEditingField(null)}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between group">
                        <p className="text-gray-600 font-normal text-sm">{selectedApp.status[field]}</p>
                        <button 
                          onClick={() => {
                            setEditingField(field);
                            setEditValue(selectedApp.status[field]);
                          }}
                          className="text-[10px] text-gray-400 hover:text-[#001F3F] ml-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AppCardProps {
  app: AppItem;
  onDelete: () => void;
  onShowStatus: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ app, onDelete, onShowStatus }) => {
  const [isHovered, setIsHovered] = useState(false);

  const menuItems = [
    { label: 'Current Status', onClick: onShowStatus },
    { 
      label: 'External Workspaces', 
      onClick: () => app.externalUrl && window.open(app.externalUrl, '_blank'),
      disabled: !app.externalUrl 
    },
    { label: 'Delete', onClick: onDelete, className: 'text-red-500' },
  ];

  return (
    <div className="flex flex-col items-center gap-1 relative w-full">
      <span className="text-[10px] text-gray-400 font-normal truncate w-full text-center">{app.name}</span>
      <div 
        className="relative w-12 h-12"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button 
          onClick={() => window.open(app.mainUrl, '_blank')}
          className="w-full h-full neumorph-card rounded-xl flex items-center justify-center hover:neumorph-inset transition-all text-lg font-bold text-[#001F3F]"
        >
          {app.name.charAt(0).toUpperCase()}
        </button>

        {/* Hover Menu */}
        <AnimatePresence>
          {isHovered && (
            <>
              {/* Connector Line & Dot */}
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: 12 }}
                exit={{ height: 0 }}
                className="absolute top-full left-1/2 -translate-x-1/2 w-[1px] bg-[#001F3F] origin-top z-10"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#001F3F] rounded-full" />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full left-1/2 -translate-x-1/2 w-40 bg-white border border-[#001F3F] mt-3 rounded-lg shadow-xl z-20 overflow-hidden"
              >
                <div className="flex flex-col">
                  {menuItems.map((item, index) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      disabled={item.disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClick();
                      }}
                      className={`p-2 text-left hover:bg-gray-50 text-[11px] transition-colors border-b last:border-b-0 border-gray-100 ${item.className || ''} ${item.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      {item.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  glass?: boolean;
  disableOutsideClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({ children, onClose, glass, disableOutsideClick }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (disableOutsideClick) return;
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleOutsideClick}
      className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
    >
      <motion.div 
        ref={modalRef}
        initial={{ scale: 0.98, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 10 }}
        className={`${glass ? 'glass-panel' : 'bg-white border border-[#001F3F]'} rounded-2xl shadow-2xl max-w-2xl w-full relative overflow-hidden`}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-black/5 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
