
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  Share2, 
  Trash2, 
  GripVertical, 
  CheckCircle2, 
  Circle,
  Sparkles,
  ShoppingBag,
  MoreVertical
} from 'lucide-react';
import { ShoppingList, ListItem, View } from './types';
import { getSmartSuggestions } from './services/geminiService';

const STORAGE_KEY = 'v_shop_lists';

const App: React.FC = () => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setLists(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved lists");
      }
    }

    // Check for shared list in URL hash
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const sharedData = JSON.parse(atob(hash.substring(7)));
        if (sharedData && sharedData.name) {
          const newList: ShoppingList = {
            ...sharedData,
            id: 'shared-' + Date.now(),
            createdAt: Date.now()
          };
          setLists(prev => {
            const updated = [newList, ...prev];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
          window.location.hash = '';
          alert('Uvožen deljen seznam!');
        }
      } catch (e) {
        console.error("Failed to import shared list");
      }
    }
  }, []);

  useEffect(() => {
    if (lists.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    }
  }, [lists]);

  const activeList = lists.find(l => l.id === activeListId);

  // Handlers
  const createList = () => {
    const name = newListName.trim().toUpperCase();
    if (!name) return;
    const newList: ShoppingList = {
      id: Date.now().toString(),
      name: name,
      items: [],
      createdAt: Date.now()
    };
    setLists([newList, ...lists]);
    setNewListName('');
    setIsAddingList(false);
    setActiveListId(newList.id);
    setView('list');
  };

  const deleteList = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Ali ste prepričani, da želite izbrisati ta seznam?')) {
      setLists(lists.filter(l => l.id !== id));
    }
  };

  const addItem = (text: string) => {
    const rawVal = text || newItemText;
    const val = rawVal.trim().toUpperCase();
    if (!val || !activeListId) return;
    
    setLists(prev => prev.map(l => {
      if (l.id === activeListId) {
        return {
          ...l,
          items: [...l.items, { id: Date.now().toString() + Math.random(), text: val, completed: false }]
        };
      }
      return l;
    }));
    setNewItemText('');
    setSuggestions(prev => prev.filter(s => s.toUpperCase() !== val));
  };

  const toggleItem = (itemId: string) => {
    setLists(prev => prev.map(l => {
      if (l.id === activeListId) {
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i)
        };
      }
      return l;
    }));
  };

  const deleteItem = (itemId: string) => {
    setLists(prev => prev.map(l => {
      if (l.id === activeListId) {
        return {
          ...l,
          items: l.items.filter(i => i.id !== itemId)
        };
      }
      return l;
    }));
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (!activeListId) return;
    setLists(prev => prev.map(l => {
      if (l.id === activeListId) {
        const newItems = [...l.items];
        const [removed] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, removed);
        return { ...l, items: newItems };
      }
      return l;
    }));
  };

  const shareList = () => {
    if (!activeList) return;
    const shareData = btoa(JSON.stringify({ name: activeList.name, items: activeList.items }));
    const url = `${window.location.origin}${window.location.pathname}#share=${shareData}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Nakupovalni seznam: ${activeList.name}`,
        url: url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert('Povezava za deljenje je kopirana v odložišče!');
    }
  };

  const fetchSuggestions = async () => {
    if (!activeList) return;
    setIsSuggesting(true);
    const existing = activeList.items.map(i => i.text);
    const results = await getSmartSuggestions(activeList.name, existing);
    setSuggestions(results.map(s => s.toUpperCase()));
    setIsSuggesting(false);
  };

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [touchState, setTouchState] = useState<{
    isDragging: boolean;
    startY: number;
    currentY: number;
    draggedIdx: number | null;
    targetIdx: number | null;
  }>({
    isDragging: false,
    startY: 0,
    currentY: 0,
    draggedIdx: null,
    targetIdx: null
  });

  // Touch event handlers for mobile drag-and-drop
  const handleTouchStart = (e: React.TouchEvent, idx: number) => {
    const touch = e.touches[0];
    setTouchState({
      isDragging: true,
      startY: touch.clientY,
      currentY: touch.clientY,
      draggedIdx: idx,
      targetIdx: idx
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchState.isDragging || touchState.draggedIdx === null) return;

    // Prevent scrolling while dragging
    e.preventDefault();

    const touch = e.touches[0];
    const currentY = touch.clientY;

    // Find which item we're hovering over
    const element = document.elementFromPoint(touch.clientX, currentY);
    const itemElement = element?.closest('[data-item-idx]');

    if (itemElement) {
      const targetIdx = parseInt(itemElement.getAttribute('data-item-idx') || '-1');
      if (targetIdx !== -1) {
        setTouchState(prev => ({
          ...prev,
          currentY,
          targetIdx
        }));
      }
    } else {
      setTouchState(prev => ({
        ...prev,
        currentY
      }));
    }
  };

  const handleTouchEnd = () => {
    if (touchState.isDragging &&
        touchState.draggedIdx !== null &&
        touchState.targetIdx !== null &&
        touchState.draggedIdx !== touchState.targetIdx) {
      moveItem(touchState.draggedIdx, touchState.targetIdx);
    }

    setTouchState({
      isDragging: false,
      startY: 0,
      currentY: 0,
      draggedIdx: null,
      targetIdx: null
    });
  };

  return (
    <div className="h-[100dvh] max-w-md mx-auto bg-white shadow-xl flex flex-col relative overflow-hidden">
      {/* Header - Fixed at top by flex layout */}
      <header className="bg-indigo-600 text-white p-4 shrink-0 shadow-md z-50">
        <div className="flex items-center justify-between">
          {view === 'list' ? (
            <button onClick={() => setView('home')} className="p-2 -ml-2 hover:bg-indigo-500 rounded-full transition">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <ShoppingBag size={24} className="text-indigo-200" />
          )}
          
          <h1 className="text-xl font-bold truncate px-2 uppercase tracking-wide">
            {view === 'home' ? 'MOJI SEZNAMI' : activeList?.name}
          </h1>

          <div className="flex gap-2">
            {view === 'list' && (
              <button onClick={shareList} className="p-2 hover:bg-indigo-500 rounded-full transition">
                <Share2 size={20} />
              </button>
            )}
            {view === 'home' && (
              <button onClick={() => setIsAddingList(true)} className="p-2 bg-white text-indigo-600 rounded-full shadow-lg hover:bg-indigo-50 transition">
                <Plus size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable area */}
      <main className="flex-1 overflow-y-auto p-4 bg-gray-50 touch-pan-y overscroll-contain">
        {view === 'home' ? (
          <div className="space-y-3 pb-24">
            {isAddingList && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6 shadow-md animate-in fade-in zoom-in duration-200">
                <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">IME NOVEGA SEZNAMA</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="NPR. TRGOVINA, DOM..."
                  className="w-full p-4 bg-white border border-indigo-200 rounded-xl outline-none text-gray-900 text-lg font-semibold focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm uppercase"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && createList()}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button 
                    onClick={() => setIsAddingList(false)} 
                    className="px-4 py-2 text-indigo-600 font-semibold hover:bg-indigo-100 rounded-lg transition"
                  >
                    PREKLIČI
                  </button>
                  <button 
                    onClick={createList} 
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg active:scale-95 transition"
                  >
                    USTVARI
                  </button>
                </div>
              </div>
            )}

            {lists.length === 0 && !isAddingList && (
              <div className="text-center py-20 text-gray-400">
                <ShoppingBag size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg">Nimate še nobenega seznama.</p>
                <button onClick={() => setIsAddingList(true)} className="mt-4 text-indigo-600 font-bold underline uppercase">USTVARI PRVEGA</button>
              </div>
            )}

            {lists.map(list => (
              <div 
                key={list.id}
                onClick={() => { setActiveListId(list.id); setView('list'); }}
                className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between group active:scale-[0.98]"
              >
                <div>
                  <h3 className="font-bold text-lg text-gray-800 uppercase tracking-tight">{list.name}</h3>
                  <p className="text-sm text-gray-500 uppercase text-[10px] tracking-wide font-medium">{list.items.length} ARTIKLOV • {list.items.filter(i => i.completed).length} KUPLJENO</p>
                </div>
                <button 
                  onClick={(e) => deleteList(list.id, e)}
                  className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col h-full pb-24">
            {/* Add Item Input */}
            <div className="flex gap-2 mb-6 shrink-0">
              <input
                type="text"
                placeholder="DODAJ ARTIKEL..."
                className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl outline-none text-gray-900 focus:ring-2 focus:ring-indigo-500 shadow-sm uppercase font-medium"
                value={newItemText}
                onChange={e => setNewItemText(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && addItem('')}
              />
              <button 
                onClick={() => addItem('')}
                className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg active:scale-95 transition"
              >
                <Plus size={24} />
              </button>
            </div>

            {/* Smart Suggestions */}
            <div className="mb-6 px-1 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={14} className="text-indigo-400" /> PAMETNI PREDLOGI
                </h4>
                {!isSuggesting && (
                  <button onClick={fetchSuggestions} className="text-xs text-indigo-600 font-bold uppercase">OSVEŽI</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isSuggesting ? (
                  <div className="w-full h-10 bg-gray-200 animate-pulse rounded-xl"></div>
                ) : (
                  suggestions.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => addItem(s)}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-100 hover:bg-indigo-100 active:scale-95 transition uppercase tracking-tighter"
                    >
                      + {s}
                    </button>
                  ))
                )}
                {!isSuggesting && suggestions.length === 0 && (
                  <p className="text-xs text-gray-400 italic uppercase">Ni predlogov. Kliknite osveži.</p>
                )}
              </div>
            </div>

            {/* List Items */}
            <div
              className="space-y-3 flex-1"
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {activeList?.items.map((item, idx) => (
                <div
                  key={item.id}
                  data-item-idx={idx}
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={() => {
                    if (draggedIdx !== null && draggedIdx !== idx) {
                      moveItem(draggedIdx, idx);
                    }
                    setDraggedIdx(null);
                  }}
                  className={`
                    flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm transition
                    ${draggedIdx === idx || touchState.draggedIdx === idx ? 'opacity-50 scale-95' : ''}
                    ${touchState.targetIdx === idx && touchState.draggedIdx !== idx ? 'border-indigo-400 border-2' : ''}
                    ${item.completed ? 'bg-gray-50 opacity-75' : ''}
                  `}
                >
                  <div
                    className="drag-handle text-gray-300 cursor-grab p-1 touch-none"
                    onTouchStart={(e) => handleTouchStart(e, idx)}
                  >
                    <GripVertical size={20} />
                  </div>
                  
                  <button onClick={() => toggleItem(item.id)} className="shrink-0">
                    {item.completed ? (
                      <CheckCircle2 size={26} className="text-green-500" />
                    ) : (
                      <Circle size={26} className="text-gray-300" />
                    )}
                  </button>

                  <span className={`flex-1 text-lg transition font-bold uppercase tracking-tight ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.text}
                  </span>

                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-gray-300 hover:text-red-400 transition"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
              
              {activeList?.items.length === 0 && (
                <div className="text-center py-10 text-gray-400 italic uppercase text-xs">
                  Seznam je prazen. Dodajte artikle zgoraj.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Persistent Bottom Nav - Fixed at bottom by layout */}
      <nav className="bg-white border-t border-gray-100 p-4 shrink-0 flex justify-around items-center z-50 shadow-inner">
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${view === 'home' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
          <ShoppingBag size={24} />
          <span className="text-[10px] font-bold uppercase">SEZNAMI</span>
        </button>
        <button 
          disabled={!activeListId}
          onClick={() => setView('list')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${view === 'list' ? 'text-indigo-600' : 'text-gray-400 opacity-50'}`}
        >
          <Plus size={24} />
          <span className="text-[10px] font-bold uppercase">UREJANJE</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
