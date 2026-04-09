import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
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
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User, signInWithPopup } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType, googleProvider } from './firebase';

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
  order?: number;
}

const springTransition = {
  type: "spring",
  stiffness: 350,
  damping: 30,
  mass: 1
};

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
      
      // Sort in memory: items with 'order' first, then by 'createdAt'
      const sortedApps = [...appsData].sort((a, b) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });
      
      setApps(sortedApps);
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
        appData.order = apps.length;
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
    if (!id) return;
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

  const lastReorderTime = useRef(0);
  const handleDrag = (id: string, point: { x: number, y: number }) => {
    const now = Date.now();
    if (now - lastReorderTime.current < 150) return;

    const draggedIndex = apps.findIndex(app => app.id === id);
    if (draggedIndex === -1) return;

    const elements = document.querySelectorAll('[data-drag-id]');
    let targetId: string | null = null;
    let minDistance = 60; // Threshold for swapping
    
    elements.forEach((el) => {
      const elId = el.getAttribute('data-drag-id');
      if (elId === id) return;

      const rect = el.getBoundingClientRect();
      // Use an inset to create a "dead zone" at the boundaries.
      // This prevents the infinite swapping loop (oscillation).
      const inset = 25; 
      if (point.x > rect.left + inset && point.x < rect.right - inset &&
          point.y > rect.top + inset && point.y < rect.bottom - inset) {
        targetId = elId;
      }
    });

    if (targetId) {
      const targetIndex = apps.findIndex(app => app.id === targetId);
      if (targetIndex !== -1 && targetIndex !== draggedIndex) {
        lastReorderTime.current = now;
        const newApps = [...apps];
        const [moved] = newApps.splice(draggedIndex, 1);
        newApps.splice(targetIndex, 0, moved);
        setApps(newApps);
      }
    }
  };

  const handleDragEnd = async () => {
    try {
      const batch = writeBatch(db);
      apps.forEach((app, index) => {
        const appRef = doc(db, 'apps', app.id);
        batch.update(appRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error reordering apps:", error);
    }
  };

  const selectedApp = apps.find(app => app.id === statusModalAppId);
  const isAdmin = user?.email === 'implicatio@naver.com';

  return (
    <div className="min-h-screen bg-[#EEEEEE] p-8 font-pretendard text-[#6F6F6F] relative">
      {/* Login/Logout Button */}
      <div className="absolute top-4 right-4 z-20">
        {user ? (
          <button 
            onClick={() => auth.signOut()}
            className="text-[10px] text-gray-400 hover:text-[#3B3B3B] transition-colors uppercase tracking-widest"
          >
            Logout
          </button>
        ) : (
          <button 
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="text-[10px] text-gray-400 hover:text-[#3B3B3B] transition-colors uppercase tracking-widest"
          >
            Admin Login
          </button>
        )}
      </div>

      {/* Header */}
      <header className="max-w-4xl mx-auto mb-16 mt-8">
        <h1 className="text-2xl md:text-3xl text-center leading-tight font-nunito font-bold italic text-[#3B3B3B] inline-block w-full">
          hospitality <span className="text-[#20A200]">&</span> interior dept.<br />
          <span className="text-[#20A200]">AI</span> design hub
        </h1>
      </header>

      {/* App Grid */}
      <div className="flex justify-center w-full overflow-x-auto custom-scrollbar pb-12">
        <div className="flex flex-wrap gap-x-6 gap-y-4 justify-center min-w-fit px-8">
          <AnimatePresence initial={false}>
            {apps.map((app, index) => (
              <React.Fragment key={app.id}>
                <AppCard 
                  app={app} 
                  isAdmin={isAdmin}
                  onDelete={() => handleDeleteApp(app.id)}
                  onShowStatus={() => setStatusModalAppId(app.id)}
                  onEdit={() => openEditModal(app)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                />
                {(index + 1) % 6 === 0 && <div className="w-full h-0 md:block hidden" />}
                {(index + 1) % 3 === 0 && <div className="w-full h-0 md:hidden block" />}
              </React.Fragment>
            ))}

            {/* Add Button Card */}
            {isAdmin && (
              <motion.div 
                layout="position"
                transition={springTransition}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
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
                    className="w-12 h-12 neumorph-card rounded-xl flex items-center justify-center hover:neumorph-inset transition-all group cursor-pointer overflow-hidden p-0"
                  >
                    <div className="w-full h-full flex items-center justify-center hover:bg-black/5 transition-all">
                      <Plus className="w-5 h-5 group-hover:scale-110 transition-transform text-[#3B3B3B]" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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
                          onBlur={() => {
                            if (selectedApp && editValue !== selectedApp.status[field]) {
                              handleUpdateStatus(selectedApp.id, field, editValue);
                            } else {
                              setEditingField(null);
                            }
                          }}
                          className="w-full p-3 text-sm bg-white/60 rounded-lg focus:outline-none border border-white/20 min-h-[150px] resize-y custom-scrollbar text-[#3B3B3B]"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                        />
                        <div className="flex justify-end gap-2">
                          <p className="text-[10px] text-gray-400 italic">Auto-saving...</p>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className={`flex items-start justify-between group bg-white/60 rounded-lg p-2 border border-white/10 transition-colors ${isAdmin ? 'cursor-pointer hover:bg-white/80' : 'cursor-default'}`}
                        onClick={async () => {
                          if (!isAdmin) return;
                          if (editingField && selectedApp && editValue !== selectedApp.status[editingField]) {
                            await handleUpdateStatus(selectedApp.id, editingField, editValue);
                          }
                          setEditingField(field);
                          setEditValue(selectedApp.status[field]);
                        }}
                      >
                        <p className="text-[#3B3B3B] font-normal text-sm whitespace-pre-wrap flex-1">{selectedApp.status[field]}</p>
                        {isAdmin && (
                          <button 
                            className="text-[10px] text-gray-400 hover:text-[#3B3B3B] ml-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </button>
                        )}
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
  isAdmin: boolean;
  onDelete: () => void;
  onShowStatus: () => void;
  onEdit: () => void;
  onDrag: (id: string, point: { x: number, y: number }) => void;
  onDragEnd: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ app, isAdmin, onDelete, onShowStatus, onEdit, onDrag, onDragEnd }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.div 
      layout="position"
      data-drag-id={app.id}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragSnapToOrigin
      onDrag={(_, info) => onDrag(app.id, info.point)}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
        zIndex: 1,
        width: isExpanded ? 180 : 80
      }}
      whileDrag={{ 
        zIndex: 50,
        scale: 1.02,
      }}
      exit={{ 
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.2 }
      }}
      transition={{
        ...springTransition,
        width: { 
          delay: isExpanded ? 0 : 0.3, 
          duration: 0.3, 
          ease: "circOut" 
        }
      }}
      className="flex flex-col items-center gap-3 shrink-0 relative"
      ref={cardRef}
    >
      <div 
        className="h-10 flex items-end justify-center w-20 cursor-grab active:cursor-grabbing group select-none touch-none"
        onPointerDown={(e) => {
          setIsExpanded(false);
          dragControls.start(e);
        }}
      >
        <span className="text-[10px] text-[#3B3B3B] font-normal w-full text-center break-words leading-tight tracking-widest uppercase px-1 transition-all duration-200 group-hover:[text-shadow:0.5px_0_currentColor]">
          {app.name}
        </span>
      </div>
      
      <div className="relative w-full flex justify-center">
        <motion.div 
          onClick={(e) => {
            // Prevent expansion if we're just finishing a drag
            setIsExpanded(!isExpanded);
          }}
          animate={{ 
            width: isExpanded ? 180 : 48,
          }}
          transition={{
            width: { 
              delay: isExpanded ? 0 : 0.3, 
              duration: 0.3, 
              ease: "circOut" 
            }
          }}
          className="flex flex-col neumorph-card rounded-xl p-0 overflow-hidden cursor-pointer"
        >
          <div className={`flex items-center w-full h-12 shrink-0 px-4 transition-colors ${!isExpanded ? 'hover:bg-black/5' : ''}`}>
            <div className="w-full flex items-center justify-center overflow-hidden">
              <motion.div 
                layout 
                className="flex items-center whitespace-nowrap"
              >
                {/* 첫 글자 (이니셜) */}
                <motion.span
                  layout="position"
                  className={`font-bold text-[#3B3B3B] tracking-widest transition-all duration-300 ${
                    isExpanded ? 'text-[12px]' : 'text-lg'
                  }`}
                >
                  {app.name.charAt(0).toUpperCase()}
                </motion.span>

                {/* 나머지 글자들 */}
                <AnimatePresence mode="wait">
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0, x: -5 }}
                      animate={{ opacity: 1, width: 'auto', x: 0 }}
                      exit={{ opacity: 0, width: 0, x: -5 }}
                      transition={{ 
                        duration: 0.25, 
                        ease: "easeInOut"
                      }}
                      className="font-bold text-[#3B3B3B] text-[12px] tracking-widest overflow-hidden"
                    >
                      {app.name.slice(1).toUpperCase()}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={false}
            animate={{ 
              gridTemplateRows: isExpanded ? "1fr" : "0fr",
            }}
            transition={{
              delay: isExpanded ? 0.3 : 0,
              duration: 0.3,
              ease: "circOut"
            }}
            style={{ display: "grid" }}
            className="border-t border-gray-200/50 bg-white/5"
          >
            <div className="overflow-hidden">
              <div className="flex flex-col items-stretch pb-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); window.open(app.mainUrl, '_blank'); }}
                  className="w-full py-3 px-4 text-[9px] text-[#20A200] font-bold tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                >
                  Visit
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onShowStatus(); }}
                  className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-normal tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                >
                  Current Status
                </button>
                {app.externalUrl && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(app.externalUrl, '_blank'); }}
                    className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-normal tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                  >
                    External Workspace
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEdit(); }}
                      className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-normal tracking-widest hover:bg-black/5 transition-all uppercase text-left border-b border-gray-100/50"
                    >
                      Edit Details
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="w-full py-3 px-4 text-[9px] text-[#3B3B3B] font-normal tracking-widest hover:bg-black/5 transition-all uppercase text-left"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
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
