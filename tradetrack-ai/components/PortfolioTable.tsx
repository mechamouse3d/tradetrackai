import React from 'react';
import { StockSummary, Transaction } from '../types';
import { ChevronDown, ChevronRight, CircleCheck, Pen, Trash2 } from 'lucide-react';

interface PortfolioTableProps {
  portfolio: StockSummary[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  expandedRows: Record<string, boolean>;
  setExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const PortfolioTable: React.FC<PortfolioTableProps> = ({ portfolio, onDelete, onEdit, expandedRows, setExpandedRows }) => {

  const toggleRow = (symbolKey: string) => {
    setExpandedRows(prev => ({ ...prev, [symbolKey]: !prev[symbolKey] }));
  };

  const getCurrencySymbol = (currency: string) => (currency === 'CAD' ? 'C$' : '$');

  if (portfolio.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-200">
        <p className="text-slate-500">No transactions found. Add one to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left table-fixed min-w-[1100px]">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-4 w-12"></th>
              <th className="px-4 py-4 w-[12%]">Symbol</th>
              <th className="px-4 py-4 w-[18%]">Stock Name</th>
              <th className="px-4 py-4 text-right w-[8%]">Shares</th>
              <th className="px-4 py-4 text-right w-[10%]">Avg Price</th>
              <th className="px-4 py-4 text-right w-[10%]">Total Cost</th>
              <th className="px-4 py-4 text-right w-[10%]">Current Price</th>
              <th className="px-4 py-4 text-right w-[10%]">Market Value</th>
              <th className="px-4 py-4 text-right w-[11%]">Unrealized P/L</th>
              <th className="px-4 py-4 text-right w-[11%]">Realized Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {portfolio.map((p) => {
              const symbolKey = `${p.symbol}_${p.currency}`;
              const isExpanded = expandedRows[symbolKey];
              const isClosed = p.totalShares <= 0;
              const currencySymbol = getCurrencySymbol(p.currency);
              const unrealizedPL = !isClosed && p.currentPrice ? (p.currentPrice - p.avgCost) * p.totalShares : 0;
              const marketValue = !isClosed && p.currentPrice ? p.currentPrice * p.totalShares : 0;

              return (
                <React.Fragment key={symbolKey}>
                  <tr className={`transition-colors ${isClosed ? 'bg-slate-50/40 hover:bg-slate-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-4 text-center cursor-pointer" onClick={() => toggleRow(symbolKey)}>
                      {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isClosed ? 'text-slate-400' : 'text-slate-900'}`}>{p.symbol}</span>
                          <span className="text-[9px] font-black px-1 rounded bg-slate-100 text-slate-500">{p.currency}</span>
                        </div>
                        {isClosed && (
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter flex items-center gap-1">
                            <CircleCheck size={10} /> Closed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-4 font-medium truncate ${isClosed ? 'text-slate-400' : 'text-slate-700'}`}>{p.name}</td>
                    <td className={`px-4 py-4 text-right font-medium ${isClosed ? 'text-slate-400' : 'text-slate-900'}`}>{p.totalShares.toLocaleString()}</td>
                    <td className={`px-4 py-4 text-right ${isClosed ? 'text-slate-400' : 'text-slate-600'}`}>{isClosed ? '-' : `${currencySymbol}${p.avgCost.toFixed(2)}`}</td>
                    <td className={`px-4 py-4 text-right font-medium ${isClosed ? 'text-slate-400' : 'text-slate-800'}`}>{isClosed ? '-' : `${currencySymbol}${p.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td>
                    <td className={`px-4 py-4 text-right ${isClosed ? 'text-slate-300 italic' : 'text-slate-600'}`}>{isClosed ? 'Finalized' : p.currentPrice ? `${currencySymbol}${p.currentPrice.toFixed(2)}` : '-'}</td>
                    <td className={`px-4 py-4 text-right font-medium ${isClosed ? 'text-slate-300 italic' : 'text-slate-800'}`}>{isClosed ? 'Finalized' : p.currentPrice ? `${currencySymbol}${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                    <td className={`px-4 py-4 text-right font-bold ${isClosed ? 'text-slate-300' : unrealizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isClosed ? 'N/A' : p.currentPrice ? `${unrealizedPL >= 0 ? '+' : ''}${currencySymbol}${Math.abs(unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`px-4 py-4 text-right font-black ${p.realizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'} ${isClosed ? 'bg-indigo-50/30' : ''}`}>
                      <div className="flex flex-col">
                        <span>{p.realizedPL >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(p.realizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        {isClosed && <span className="text-[9px] uppercase opacity-60">Total Profit</span>}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-white">
                      <td colSpan={10} className="p-0">
                        <div className="border-b border-slate-100 bg-slate-50/20">
                          <table className="w-full text-xs">
                            <thead className="text-slate-400 bg-slate-50">
                              <tr>
                                <th className="px-8 py-3 text-left w-[12%]">Date</th>
                                <th className="px-4 py-3 text-left w-[8%]">Type</th>
                                <th className="px-4 py-3 text-left w-[12%]">Account</th>
                                <th className="px-4 py-3 text-left w-[10%]">Exchange</th>
                                <th className="px-4 py-3 text-right w-[10%]">Shares</th>
                                <th className="px-4 py-3 text-right w-[10%]">Price</th>
                                <th className="px-4 py-3 text-right w-[10%]">Cost/Basis</th>
                                <th className="px-4 py-3 text-right w-[13%]">Cur. Value</th>
                                <th className="px-4 py-3 text-right w-[15%]">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {p.transactions.map(tx => {
                                const currentValue = !isClosed && p.currentPrice ? tx.shares * p.currentPrice : null;
                                return (
                                  <tr key={tx.id} className="hover:bg-slate-50">
                                    <td className="px-8 py-2.5 text-slate-500">{tx.date}</td>
                                    <td className={`px-4 py-2.5 font-bold ${tx.type === 'BUY' ? 'text-blue-600' : 'text-amber-600'}`}>{tx.type}</td>
                                    <td className="px-4 py-2.5 text-slate-500 flex items-center gap-1">
                                      <span className="uppercase font-medium">{tx.account}</span>
                                      <span className="text-[9px] font-bold bg-slate-100 px-1 rounded">{tx.currency}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-400">{tx.exchange}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">{tx.shares.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{currencySymbol}{tx.price.toFixed(2)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{currencySymbol}{(tx.shares * tx.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-400">{currentValue !== null ? `${currencySymbol}${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                    <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1">
                                      <button onClick={() => onEdit(tx)} className="text-slate-300 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                                        <Pen size={14} />
                                      </button>
                                      <button onClick={() => onDelete(tx.id)} className="text-slate-300 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50">
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioTable;