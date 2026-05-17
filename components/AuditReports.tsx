
"use client";

import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Search, 
  Calendar, 
  MapPin, 
  Printer,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';

interface FinalReport {
  id: string;
  reportNo: string;
  unitName: string;
  auditDate: string;
  auditor: string;
  score: number;
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  criticalNCs: number;
  majorNCs: number;
  status: 'Published' | 'Archived';
  checklistName: string;
}

const MOCK_REPORTS: FinalReport[] = [
    // NYC Central Kitchen
    { id: '1', reportNo: 'RPT-2025-001', unitName: 'NYC Central Kitchen', auditDate: '2025-05-20', auditor: 'Jane Smith', score: 95, totalScore: 100, grade: 'A', criticalNCs: 0, majorNCs: 1, status: 'Published', checklistName: 'FSSAI General Hygiene' },
    { id: '2', reportNo: 'RPT-2025-002', unitName: 'NYC Central Kitchen', auditDate: '2025-04-15', auditor: 'Mike Ross', score: 88, totalScore: 100, grade: 'B', criticalNCs: 0, majorNCs: 3, status: 'Archived', checklistName: 'Monthly Safety Audit' },
    { id: '3', reportNo: 'RPT-2025-005', unitName: 'NYC Central Kitchen', auditDate: '2025-03-10', auditor: 'Sarah Connor', score: 92, totalScore: 100, grade: 'A', criticalNCs: 0, majorNCs: 2, status: 'Archived', checklistName: 'FSSAI General Hygiene' },
    
    // LA Logistics Unit
    { id: '4', reportNo: 'RPT-2025-003', unitName: 'LA Logistics Unit', auditDate: '2025-05-18', auditor: 'John Doe', score: 78, totalScore: 100, grade: 'C', criticalNCs: 1, majorNCs: 5, status: 'Published', checklistName: 'Warehouse Safety' },
    { id: '5', reportNo: 'RPT-2025-006', unitName: 'LA Logistics Unit', auditDate: '2025-04-22', auditor: 'Jane Smith', score: 85, totalScore: 100, grade: 'B', criticalNCs: 0, majorNCs: 4, status: 'Archived', checklistName: 'Warehouse Safety' },

    // London Hub
    { id: '6', reportNo: 'RPT-2025-004', unitName: 'London Hub', auditDate: '2025-05-19', auditor: 'Emma Watson', score: 98, totalScore: 100, grade: 'A', criticalNCs: 0, majorNCs: 0, status: 'Published', checklistName: 'Global Standards Audit' },
];

const AuditReports = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Group by Unit with Enhanced Filtering
    const groupedReports = useMemo(() => {
        const groups: Record<string, FinalReport[]> = {};
        MOCK_REPORTS.forEach(report => {
            // Enhanced Filter Logic: Search across multiple fields
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                const matches = 
                    report.unitName.toLowerCase().includes(lowerTerm) ||
                    report.reportNo.toLowerCase().includes(lowerTerm) ||
                    report.auditor.toLowerCase().includes(lowerTerm) ||
                    report.checklistName.toLowerCase().includes(lowerTerm) ||
                    report.status.toLowerCase().includes(lowerTerm);
                
                if (!matches) return;
            }
            
            if (!groups[report.unitName]) {
                groups[report.unitName] = [];
            }
            groups[report.unitName].push(report);
        });

        // Sort reports within each group by date desc
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime());
        });

        return groups;
    }, [searchTerm]);

    const toggleUnit = (unitName: string) => {
        setCollapsedUnits(prev => {
            const next = new Set(prev);
            if (next.has(unitName)) {
                next.delete(unitName);
            } else {
                next.add(unitName);
            }
            return next;
        });
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        // Simulate network fetch / data reload
        setTimeout(() => {
            setSearchTerm(''); // Reset search on refresh
            setIsRefreshing(false);
        }, 800);
    };

    const getGradeColor = (grade: string) => {
        switch(grade) {
            case 'A': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
            case 'B': return 'text-blue-600 bg-blue-50 border-blue-100';
            case 'C': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'D': return 'text-red-600 bg-red-50 border-red-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-600';
        if (score >= 80) return 'text-blue-600';
        if (score >= 70) return 'text-orange-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                <div className="flex items-center gap-5 z-10 w-full md:w-auto">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-inner border border-indigo-100 shrink-0">
                        <FileText size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Final Audit Reports</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em]">Published Inspection Records</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto z-10">
                    <div className="relative group flex-1 md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search unit, auditor or ID..." 
                            className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 transition-all shadow-sm uppercase tracking-wider"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleRefresh}
                        className="p-3.5 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95 shrink-0"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Content: Unit Wise Cards */}
            <div className="grid grid-cols-1 gap-8">
                {Object.entries(groupedReports).map(([unitName, reports]: [string, FinalReport[]]) => {
                    const isExpanded = !collapsedUnits.has(unitName);
                    
                    return (
                        <div key={unitName} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all">
                            
                            {/* Unit Header */}
                            <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleUnit(unitName)}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 shrink-0 group-hover:text-indigo-500 transition-colors">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{unitName}</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reports.length} Reports Available</span>
                                    </div>
                                </div>
                                <button 
                                    className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all hover:bg-slate-50 shadow-sm"
                                >
                                   {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>

                            {/* Reports List (Sub Cards) */}
                            {isExpanded && (
                                <div className="p-6 md:p-8 space-y-3 bg-slate-50/20 animate-in slide-in-from-top-2">
                                    {reports.map((report) => (
                                        <div key={report.id} className="bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all p-5 flex flex-col md:flex-row items-center gap-6 group">
                                            
                                            {/* Left: Report Info */}
                                            <div className="flex-1 w-full md:w-auto">
                                                <div className="flex items-center justify-between md:justify-start gap-4 mb-2">
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{report.reportNo}</span>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        <Calendar size={12} className="text-indigo-400"/> {new Date(report.auditDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </div>
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight mb-1 truncate">{report.checklistName}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Auditor: <span className="text-slate-600">{report.auditor}</span></p>
                                            </div>

                                            {/* Center: Scores & NCs */}
                                            <div className="flex items-center justify-between w-full md:w-auto gap-8 md:border-l md:border-r border-slate-100 md:px-8">
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-2xl font-black ${getScoreColor(report.score)}`}>{report.score}%</span>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${getGradeColor(report.grade)}`}>Grade {report.grade}</span>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Critical NC</span>
                                                        <span className={`text-xs font-black ${report.criticalNCs > 0 ? 'text-red-600' : 'text-slate-300'}`}>{report.criticalNCs}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Major NC</span>
                                                        <span className={`text-xs font-black ${report.majorNCs > 0 ? 'text-orange-500' : 'text-slate-300'}`}>{report.majorNCs}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                                <button className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm" title="View Report">
                                                    <Eye size={18} />
                                                </button>
                                                <button className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 transition-all shadow-sm" title="Download PDF">
                                                    <Download size={18} />
                                                </button>
                                                <button className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm" title="Print">
                                                    <Printer size={18} />
                                                </button>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            )}
                            
                        </div>
                    );
                })}
                
                {Object.keys(groupedReports).length === 0 && (
                    <div className="p-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No audit reports found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditReports;
