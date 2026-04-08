import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, X, Activity, TrendingUp, TrendingDown, Minus, Target, RefreshCw, FolderPlus, Trash2, Loader2, Pen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { analyzeWatchlist, WatchlistAnalysis, getWatchlistMetrics, WatchlistMetrics, searchStockSymbols, StockSearchResult } from '../services/aiAnalyzer';
import { WatchlistGroup } from '../types';

const WatchlistPanel: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id || 'demo';
  
  const [watchlists, setWatchlists] = useState<WatchlistGroup[]>([]);
  const [activeListId, setActiveListId] = useState<string>('default');
  const [newSymbol, setNewSymbol] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<WatchlistAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, WatchlistMetrics>>({});
  const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const activeList = watchlists.find(w => w.id === activeListId) || watchlists[0];
  const activeSymbols = activeList?.symbols || [];

  useEffect(() => {
    const load = async () => {
      const saved = await dataService.loadWatchlists(currentUserId);
      setWatchlists(saved);
      if (saved.length > 0 && !saved.find(w => w.id === activeListId)) {
        setActiveListId(saved[0].id);
      } else if (saved.length === 0) {
        const defaultGroup = { id: 'default', name: 'My Watchlist', symbols: [] };
        setWatchlists([defaultGroup]);
        setActiveListId(defaultGroup.id);
      }
    };
    load();
  }, [currentUserId]);

  useEffect(() => {
    setAnalysis(null);
    setError(null);
  }, [activeListId]);

  const saveLists = async (newLists: WatchlistGroup[]) => {
    setWatchlists(newLists);
    await dataService.saveWatchlists(currentUserId, newLists);
  };

  useEffect(() => {
    const query = newSymbol.trim();
    if (query.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);
      try {
        const results = await searchStockSymbols(query);
        setSearchResults(results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    
    return () => clearTimeout(timer);
  }, [newSymbol]);

  const addToList = (symbol: string) => {
    if (!activeList) return;
    if (symbol && !activeSymbols.includes(symbol)) {
      const newLists = watchlists.map(w => w.id === activeList.id ? { ...w, symbols: [...w.symbols, symbol] } : w);
      saveLists(newLists);
    }
    setNewSymbol('');
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleAddSymbol = async (e?: React.FormEvent, selectedSymbol?: string) => {
    if (e) e.preventDefault();
    if (!activeList) return;
    
    const symbol = (selectedSymbol || newSymbol).toUpperCase().trim();
    if (!symbol) return;

    if (selectedSymbol || searchResults.some(r => r.symbol.toUpperCase() === symbol)) {
      addToList(symbol);
      return;
    }

    // Validate manually typed symbol directly
    setIsSearching(true);
    try {
      const results = await searchStockSymbols(symbol);
      const exactMatch = results.find(r => r.symbol.toUpperCase() === symbol);
      if (exactMatch) {
        addToList(symbol);
      } else {
        alert(`"${symbol}" is not a recognized stock symbol.`);
      }
    } catch (err) {
      addToList(symbol); // fallback bypass
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveSymbol = (symbolToRemove: string) => {
    if (!activeList) return;
    const newLists = watchlists.map(w => w.id === activeList.id ? { ...w, symbols: w.symbols.filter(s => s !== symbolToRemove) } : w);
    saveLists(newLists);
  };

  const handleCreateList = () => {
    const name = prompt('Enter new watchlist group name:');
    if (name && name.trim()) {
      const newList: WatchlistGroup = { id: Math.random().toString(36).substr(2, 9), name: name.trim(), symbols: [] };
      const newLists = [...watchlists, newList];
      saveLists(newLists);
      setActiveListId(newList.id);
    }
  };

  const handleRenameList = () => {
    if (!activeList) return;
    const newName = prompt('Enter new name for watchlist:', activeList.name);
    if (newName && newName.trim() && newName.trim() !== activeList.name) {
      const newLists = watchlists.map(w => w.id === activeList.id ? { ...w, name: newName.trim() } : w);
      saveLists(newLists);
    }
  };

  const handleDeleteList = (id: string) => {
    if (watchlists.length <= 1) {
      alert("You must have at least one watchlist group.");
      return;
    }
    if (window.confirm("Delete this watchlist group?")) {
      const newLists = watchlists.filter(w => w.id !== id);
      saveLists(newLists);
      if (activeListId === id) setActiveListId(newLists[0].id);
    }
  };

  useEffect(() => {
    const missing = activeSymbols.filter(s => !metrics[s]);
    if (missing.length > 0 && !isFetchingMetrics) {
      loadMetrics(missing);
    }
  }, [activeListId, watchlists]);

  const loadMetrics = async (symbolsToFetch: string[]) => {
    if (symbolsToFetch.length === 0) return;
    setIsFetchingMetrics(true);
    try {
      const data = await getWatchlistMetrics(symbolsToFetch);
      setMetrics(prev => {
        const next = { ...prev };
        data.forEach(m => next[m.symbol] = m);
        return next;
      });
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    } finally {
      setIsFetchingMetrics(false);
    }
  };

  const handleAnalyze = async () => {
    if (activeSymbols.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeWatchlist(activeSymbols);
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze watchlist. Please check your API key or try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'BUY':
        return <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-bold"><TrendingUp size={12}/> BUY</span>;
      case 'SELL':
        return <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-rose-100 text-rose-700 rounded-md font-bold"><TrendingDown size={12}/> SELL</span>;
      default:
        return <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold"><Minus size={12}/> HOLD</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Target className="text-indigo-500" size={20} /> Watchlist & AI Intelligence
          </h3>
          <p className="text-xs text-slate-500 mt-1">Track stocks and get real-time sentiment analysis</p>
        </div>
        
        <div className="flex items-center gap-3">
          <form onSubmit={(e) => handleAddSymbol(e)} className="flex items-center relative z-40">
            <div className="relative">
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Add symbol..."
                className="w-36 px-3 py-1.5 text-sm border border-slate-200 rounded-l-lg focus:outline-none focus:border-indigo-500 uppercase"
              />
              {showDropdown && newSymbol.trim().length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {isSearching ? (
                    <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                      <Loader2 className="animate-spin" size={14} /> Searching...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <ul className="max-h-64 overflow-y-auto">
                      {searchResults.map(result => (
                        <li 
                          key={result.symbol} 
                          onClick={() => handleAddSymbol(undefined, result.symbol)}
                          className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <span className="font-bold text-slate-800">{result.symbol}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[120px] ml-2 text-right">{result.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 text-xs text-slate-500">No matching stocks found.</div>
                  )}
                </div>
              )}
            </div>
            <button type="submit" disabled={isSearching} className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 px-3 py-1.5 border border-l-0 border-slate-200 rounded-r-lg transition-colors flex items-center justify-center min-w-[36px]">
              {isSearching && !showDropdown ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </form>
          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || activeSymbols.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {isAnalyzing ? <Activity size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
        {watchlists.map(w => (
          <button
            key={w.id}
            onClick={() => setActiveListId(w.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeListId === w.id 
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            {w.name}
          </button>
        ))}
        <button 
          onClick={handleCreateList}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
          title="Create New Watchlist"
        >
          <FolderPlus size={18} />
        </button>
        <div className="flex items-center gap-1 ml-auto">
          <button 
            onClick={handleRenameList}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
            title="Rename Current Watchlist"
          >
            <Pen size={18} />
          </button>
          {watchlists.length > 1 && (
            <button 
              onClick={() => handleDeleteList(activeListId)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              title="Delete Current Watchlist"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Live Metrics</h4>
            <button 
              onClick={() => loadMetrics(activeSymbols)} 
              disabled={isFetchingMetrics || activeSymbols.length === 0}
              className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isFetchingMetrics ? "animate-spin" : ""} /> Refresh
            </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {activeSymbols.length === 0 && <div className="col-span-full text-sm text-slate-400 italic p-4 border border-dashed rounded-xl border-slate-200">No symbols in watchlist. Add some to get started!</div>}
          {activeSymbols.map(symbol => {
             const m = metrics[symbol];
             return (
               <div key={symbol} className="bg-white border border-slate-200 rounded-xl p-5 relative shadow-sm hover:shadow-md transition-all group">
                 <button onClick={() => handleRemoveSymbol(symbol)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                   <X size={16} />
                 </button>
                 <div className="font-black text-lg text-slate-800 mb-1">{symbol}</div>
                 
                 {m ? (
                    <div className="space-y-3">
                       <div className="flex justify-between items-end">
                         <span className="text-2xl font-bold text-slate-900">{m.currentPrice} <span className="text-xs text-slate-400 font-medium">{m.currency}</span></span>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                         <div className="flex flex-col">
                           <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">1M</span>
                           <span className={`text-xs font-semibold ${m.growth1M.includes('-') ? 'text-rose-500' : 'text-emerald-500'}`}>{m.growth1M}</span>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">6M</span>
                           <span className={`text-xs font-semibold ${m.growth6M.includes('-') ? 'text-rose-500' : 'text-emerald-500'}`}>{m.growth6M}</span>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">1Y</span>
                           <span className={`text-xs font-semibold ${m.growth1Y.includes('-') ? 'text-rose-500' : 'text-emerald-500'}`}>{m.growth1Y}</span>
                         </div>
                       </div>
                       
                       <div className="flex justify-between items-center pt-2 text-[10px] text-slate-500">
                         <span>Mkt Cap: <span className="font-medium text-slate-700">{m.marketCap}</span></span>
                         <span>P/E: <span className="font-medium text-slate-700">{m.peRatio}</span></span>
                       </div>
                    </div>
                 ) : isFetchingMetrics ? (
                    <div className="mt-3 text-xs text-slate-400 flex items-center gap-2 py-4">
                      <Activity size={14} className="animate-pulse" /> Fetching live metrics...
                    </div>
                 ) : (
                    <div className="mt-3 text-xs text-rose-400 flex items-center gap-2 py-4">
                      <X size={14} /> Metrics unavailable
                    </div>
                 )}
               </div>
             );
          })}
        </div>

        {error && <div className="p-4 bg-rose-50 text-rose-600 text-sm rounded-xl mb-6 border border-rose-100">{error}</div>}

        {analysis && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-xl">
              <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity size={14} /> Broad Market Assessment</h4>
              <p className="text-sm text-indigo-900/80 leading-relaxed">{analysis.marketTrend}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Watchlist Analysis</h4>
                <div className="space-y-3">
                  {analysis.watchlistAnalysis.map((item) => (
                    <div key={item.symbol} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-800">{item.symbol}</span>
                        {getRecommendationBadge(item.recommendation)}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.justification}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">AI Recommended Additions</h4>
                <div className="space-y-3">
                  {analysis.recommendedAdditions.map((item) => (
                    <div key={item.symbol} className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-emerald-900">{item.symbol}</span>
                        <span className="text-xs font-medium text-emerald-600/70">{item.companyName}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.justification}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPanel;