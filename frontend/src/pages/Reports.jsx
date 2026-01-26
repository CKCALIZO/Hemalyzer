import { useState, useEffect } from "react";
import { Header} from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";

export const Reports = () => {
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);

    useEffect(() => {
        // Load saved reports from localStorage
        const savedReports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        setReports(savedReports);
    }, []);

    const deleteReport = (id) => {
        const updatedReports = reports.filter(r => r.id !== id);
        setReports(updatedReports);
        localStorage.setItem('hemalyzer_reports', JSON.stringify(updatedReports));
        if (selectedReport?.id === id) {
            setSelectedReport(null);
        }
    };

    const clearAllReports = () => {
        if (confirm('Are you sure you want to delete all reports?')) {
            setReports([]);
            setSelectedReport(null);
            localStorage.removeItem('hemalyzer_reports');
        }
    };

    return(
        <div className="flex flex-col min-h-screen bg-stone-50">
            <Header />
            <main className="flex grow flex-col px-12 py-16">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="flex justify-between items-end mb-12 border-b border-stone-200 pb-10">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-2 block">Archive Manager</span>
                            <h1 className="text-6xl font-black text-zinc-950 tracking-tighter">Analysis Reports</h1>
                        </div>
                        {reports.length > 0 && (
                            <button
                                onClick={clearAllReports}
                                className="px-6 py-3 bg-white text-rose-600 border border-stone-200 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-50 hover:border-rose-200 transition-all shadow-sm"
                            >
                                Clear All Data
                            </button>
                        )}
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[40px] border border-stone-200 shadow-sm">
                            <div className="w-20 h-20 bg-stone-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            </div>
                            <p className="text-2xl font-black text-zinc-950 tracking-tight">No clinical reports archived</p>
                            <p className="text-sm text-slate-400 mt-2 font-medium">Analyze an image and save the result to generate a persistent report</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            {/* Reports List */}
                            <div className="lg:col-span-4 space-y-6">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Clinical History ({reports.length})</h2>
                                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                                    {reports.map((report) => (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`p-6 rounded-[32px] cursor-pointer border transition-all duration-300 ${
                                                selectedReport?.id === report.id
                                                    ? 'border-rose-500 bg-white shadow-xl shadow-rose-600/5'
                                                    : 'border-stone-200 hover:border-stone-300 bg-white shadow-sm'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`w-2 h-2 rounded-full ${selectedReport?.id === report.id ? 'bg-rose-500 animate-pulse' : 'bg-stone-300'}`}></span>
                                                        <p className="font-black text-sm text-zinc-950 tracking-tight">Report #{report.id.toString().slice(-4)}</p>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{report.timestamp}</p>
                                                    
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <span className="text-[9px] font-black bg-stone-100 text-slate-600 px-2 py-1 rounded-full">{report.summary?.totalCells || report.data?.stage1_detection?.total || 0} CELLS</span>
                                                        {report.summary?.estimatedWBCCount > 0 && (
                                                            <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-full">WBC ACTIVE</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteReport(report.id);
                                                    }}
                                                    className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Report Detailed View */}
                            <div className="lg:col-span-8">
                                {selectedReport ? (
                                    <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 overflow-hidden min-h-[600px]">
                                        <div className="bg-zinc-950 p-10 text-white flex justify-between items-center">
                                            <div>
                                                <h2 className="text-3xl font-black tracking-tighter mb-2">Detailed Case Study</h2>
                                                <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Generated on {selectedReport.timestamp}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-4xl font-black text-rose-500">#{selectedReport.id.toString().slice(-4)}</span>
                                            </div>
                                        </div>
                                        <div className="p-10 space-y-10">
                                            {/* Top Summary Stats */}
                                            <div className="grid grid-cols-4 gap-6">
                                                <div className="p-6 bg-stone-50 rounded-[24px] border border-stone-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cells</p>
                                                    <p className="text-3xl font-black text-zinc-950">{selectedReport.summary?.totalCells || selectedReport.data?.stage1_detection?.total || 0}</p>
                                                </div>
                                                <div className="p-6 bg-stone-50 rounded-[24px] border border-stone-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">WBC Found</p>
                                                    <p className="text-3xl font-black text-rose-600">{selectedReport.summary?.wbcCount || selectedReport.data?.stage1_detection?.counts?.WBC || 0}</p>
                                                </div>
                                                <div className="p-6 bg-stone-50 rounded-[24px] border border-stone-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">RBC Found</p>
                                                    <p className="text-3xl font-black text-zinc-950">{selectedReport.summary?.rbcCount || selectedReport.data?.stage1_detection?.counts?.RBC || 0}</p>
                                                </div>
                                                <div className="p-6 bg-stone-50 rounded-[24px] border border-stone-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. WBC/μL</p>
                                                    <p className="text-3xl font-black text-rose-600">{selectedReport.summary?.estimatedWBCCount?.toLocaleString() || "N/A"}</p>
                                                </div>
                                            </div>

                                            {/* Analysis Content */}
                                            <div className="border-t border-stone-100 pt-10">
                                                <ThresholdResults data={selectedReport.data} results={selectedReport.results} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed border-stone-200 rounded-[40px] p-20 text-center">
                                        <div>
                                            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                            </div>
                                            <p className="text-xl font-black text-slate-300 tracking-tight">Select a case study to view details</p>
                                            <p className="text-sm text-slate-400 font-medium mt-2">All clinical data is stored locally for session persistence</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};
