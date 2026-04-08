import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

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
  createdAt?: any;
}

export default function App() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Real-time listener
    const q = query(collection(db, 'apps'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AppItem[];
      setApps(appsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'apps');
    });

    return () => unsubscribe();
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [statusModalAppId, setStatusModalAppId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Add/Edit Modal State
  const [newName, setNewName] = useState('');
  const [newMainUrl, setNewMainUrl] = useState('');
  const [newExternalUrl, setNewExternalUrl] = useState('');

  const openAddModal = () => {
    setEditingAppId(null);
    setNewName('');
    setNewMainUrl('');
    setNewExternalUrl('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (app: AppItem) => {
    setEditingAppId(app.id);
    setNewName(app.name);
    setNewMainUrl(app.mainUrl);
    setNewExternalUrl(app.externalUrl || '');
    setIsAddModalOpen(true);
  };

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMainUrl) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const appData: any = {
        name: newName || `app${apps.length + 1}`,
        mainUrl: newMainUrl.startsWith('http') ? newMainUrl : `https://${newMainUrl}`,
        createdAt: serverTimestamp(),
        authorUid: auth.currentUser?.uid || 'anonymous'
      };

      if (newExternalUrl) {
        appData.externalUrl = newExternalUrl.startsWith('http') ? newExternalUrl : `https://${newExternalUrl}`;
      }

      if (editingAppId) {
        // Update existing app
        await updateDoc(doc(db, 'apps', editingAppId), appData);
      } else {
        // Create new app
        appData.status = {
          goal: 'Set your goal here',
          status: 'Current progress',
          next: 'Next steps',
        };
        await addDoc(collection(db, 'apps'), appData);
      }

      setIsAddModalOpen(false);
      setNewName('');
      setNewMainUrl('');
      setNewExternalUrl('');
      setEditingAppId(null);
    } catch (error) {
      console.error("Error saving app:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to save app");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Modal Edit State
  const [editingField, setEditingField] = useState<'goal' | 'status' | 'next' | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDeleteApp = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'apps', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `apps/${id}`);
    }
  };

  const handleUpdateStatus = async (id: string, field: keyof AppStatus, value: string) => {
    try {
      const appRef = doc(db, 'apps', id);
      await updateDoc(appRef, {
        [`status.${field}`]: value
      });
      setEditingField(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `apps/${id}`);
    }
  };

  const selectedApp = apps.find(app => app.id === statusModalAppId);

  return (
    <div className="min-h-screen bg-[#EEEEEE] p-8 font-pretendard text-[#6F6F6F] relative">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-16 mt-8">
        <h1 className="text-2xl md:text-3xl text-center leading-tight font-nunito font-bold italic text-[#3B3B3B] inline-block w-full">
          hospitality <span className="text-[#20A200]">&</span> interior dept.<br />
          <span className="text-[#20A200]">AI</span> design hub
        </h1>
      </header>

      {/* App Grid */}
      <main className="mx-auto grid grid-cols-[repeat(3,auto)] md:grid-cols-[repeat(6,auto)] gap-x-6 gap-y-12 justify-center w-fit">
        <AnimatePresence>
          {apps.map((app) => (
            <AppCard 
              key={app.id} 
              app={app} 
              onDelete={() => handleDeleteApp(app.id)}
              onShowStatus={() => setStatusModalAppId(app.id)}
              onEdit={() => openEditModal(app)}
            />
          ))}

          {/* Add Button Card inside AnimatePresence for layout sync */}
          <motion.div 
            key="add-button"
            layout="position"
            transition={{
              layout: {
                duration: 0.3,
                ease: "easeInOut"
              }
            }}
            className="flex flex-col items-center gap-6 w-20 shrink-0"
          >
            <div className="h-10 flex items-end justify-center w-full">
              <span className="text-[10px] opacity-0 select-none tracking-widest w-full text-center uppercase">
                spacer
              </span>
            </div>
            <div className="relative">
              <button 
                onClick={openAddModal}
                className="w-12 h-12 neumorph-card rounded-xl flex items-center justify-center hover:neumorph-inset transition-all group"
              >
                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform text-[#3B3B3B]" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Add App Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Modal 
            onClose={() => {
              setIsAddModalOpen(false);
              setSubmitError(null);
            }} 
            glass={true} 
            disableOutsideClick={true}
          >
            <div className="p-6">
              <h2 className="text-lg mb-6 font-bold text-[#3B3B3B] uppercase">
                {editingAppId ? 'EDIT DETAILS' : 'ADD NEW APP'}
              </h2>
              
              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleAddApp} className="space-y-4">
                <div>
                  <label className="block text-xs mb-1 font-medium text-[#3B3B3B]">App Name</label>
                  <input 
                    type="text" 
                    disabled={isSubmitting}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. app1"
                    className="w-full p-2 text-sm bg-white/60 rounded-lg focus:outline-none border border-white/20 text-[#3B3B3B] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium text-[#3B3B3B]">Main URL (Required)</label>
                  <input 
                    required
                    disabled={isSubmitting}
                    type="text" 
                    value={newMainUrl}
                    onChange={(e) => setNewMainUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 text-sm bg-white/60 rounded-lg focus:outline-none border border-white/20 text-[#3B3B3B] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium text-[#3B3B3B]">External Workspace URL</label>
                  <input 
                    type="text" 
                    disabled={isSubmitting}
                    value={newExternalUrl}
                    onChange={(e) => setNewExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 text-sm bg-white/60 rounded-lg focus:outline-none border border-white/20 text-[#3B3B3B] disabled:opacity-50"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-[#6F6F6F] text-white rounded-lg hover:bg-opacity-90 transition-colors mt-4 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (editingAppId ? 'SAVE CHANGES' : 'CREATE APP')}
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
            <div className="p-8 min-w-[300px] md:min-w-[500px] max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="mb-8 sticky top-0 bg-transparent z-10 py-2 -mt-2">
                <h2 className="text-lg font-bold text-[#3B3B3B] uppercase">CURRENT STATUS</h2>
              </div>
              
              <div className="space-y-6">
                {(['goal', 'status', 'next'] as const).map((field) => (
                  <div key={field}>
                    <h3 className="text-xs mb-1 font-medium capitalize text-[#3B3B3B]">{field}</h3>
                    {editingField === field ? (
                      <div className="space-y-2">
                        <textarea 
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full p-3 text-sm bg-white/60 rounded-lg focus:outline-none border border-white/20 min-h-[150px] resize-y custom-scrollbar text-[#3B3B3B]"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingField(null)}
                            className="text-xs text-gray-400 hover:underline"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(selectedApp.id, field, editValue)}
                            className="text-xs text-[#20A200] font-bold hover:underline"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex items-start justify-between group bg-white/60 rounded-lg p-2 border border-white/10 cursor-pointer hover:bg-white/80 transition-colors"
                        onClick={() => {
                          setEditingField(field);
                          setEditValue(selectedApp.status[field]);
                        }}
                      >
                        <p className="text-[#3B3B3B] font-normal text-sm whitespace-pre-wrap flex-1">{selectedApp.status[field]}</p>
                        <button 
                          className="text-[10px] text-gray-400 hover:text-[#3B3B3B] ml-4 opacity-0 group-hover:opacity-100 transition-opacity"
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
  onEdit: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ app, onDelete, onShowStatus, onEdit }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div 
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
      }}
      exit={{ 
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.2 }
      }}
      style={{ width: isHovered ? 180 : 80 }}
      transition={{
        layout: {
          duration: 0.3,
          ease: "easeInOut"
        }
      }}
      className="flex flex-col items-center gap-6 shrink-0 transition-[width] duration-300 ease-out"
    >
      <div className="h-10 flex items-end justify-center w-20">
        <span className="text-[10px] text-[#3B3B3B] font-light w-full text-center break-words leading-tight tracking-widest uppercase px-1">
          {app.name}
        </span>
      </div>
      
      <div className="relative w-full flex justify-center">
        <motion.div 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          animate={{ 
            height: isHovered ? 220 : 48,
            width: isHovered ? 180 : 48,
          }}
          transition={{
            height: { 
              delay: isHovered ? 0.25 : 0, 
              duration: 0.3, 
              ease: "circOut" 
            },
            width: { 
              delay: isHovered ? 0 : 0.25, 
              duration: 0.3, 
              ease: "circOut" 
            }
          }}
          className="flex flex-col neumorph-card rounded-xl p-0 overflow-hidden"
        >
          <div className="flex items-center w-full h-12 shrink-0">
            <button 
              onClick={() => window.open(app.mainUrl, '_blank')}
              className="w-12 h-12 flex items-center justify-center hover:bg-black/5 transition-all text-lg font-bold text-[#3B3B3B] shrink-0"
            >
              {app.name.charAt(0).toUpperCase()}
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <AnimatePresence>
              {isHovered && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    delay: 0.3,
                    duration: 0.2 
                  }}
                  className="flex flex-col items-stretch border-t border-gray-200/50 w-full bg-white/5"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); onShowStatus(); }}
                    className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-light tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                  >
                    Current Status
                  </button>
                  {app.externalUrl && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); window.open(app.externalUrl, '_blank'); }}
                      className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-light tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                    >
                      External Workspace
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-light tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                  >
                    Edit Details
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-light tracking-widest hover:bg-black/5 transition-all uppercase text-left"
                  >
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
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
        className={`${glass ? 'glass-panel' : 'bg-white border border-[#3B3B3B]'} rounded-2xl shadow-2xl max-w-2xl w-full relative overflow-hidden`}
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
