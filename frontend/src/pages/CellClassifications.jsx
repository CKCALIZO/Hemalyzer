import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";

export const CellClassifications = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [croppedCells, setCroppedCells] = useState([]);
    const [wbcClassifications, setWbcClassifications] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'wbc', 'rbc', 'abnormal'

    useEffect(() => {
        // Get data from navigation state
        if (location.state) {
            setCroppedCells(location.state.croppedCells || []);
            setWbcClassifications(location.state.wbcClassifications || []);
            setSummary(location.state.summary || null);
        }
    }, [location.state]);

    // No filtering needed - backend only sends abnormal cells
    const getFilteredCells = () => croppedCells;

    // Get color class based on classification - medical professional theme
    const getClassificationColor = (classification, cellType) => {
        if (cellType === 'RBC') {
            return 'bg-white border-stone-200 text-zinc-900 shadow-sm';
        }
        
        const cLower = classification ? classification.toLowerCase() : '';
        if (cLower.includes(': normal')) {
            return 'bg-white border-stone-200 text-zinc-900 shadow-sm';
        }
        
        return 'bg-zinc-950 border-rose-500 text-white shadow-xl shadow-rose-600/10';
    };

    // Get icon based on classification
    const getClassificationIcon = (classification, cellType) => {
        if (cellType === 'RBC') return '●';
        const cLower = classification ? classification.toLowerCase() : '';
        if (cLower.includes(': normal')) return '✓';
        return '⚠';
    };

    return (
        <div className="flex flex-col min-h-screen bg-stone-50">
            <Header />
            <main className="flex grow flex-col px-12 py-16">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="mb-12 border-b border-stone-200 pb-10 flex justify-between items-end">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-2 block">Morphological Analysis</span>
                            <h1 className="text-6xl font-black text-zinc-950 tracking-tighter">Cell Classification Results</h1>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => navigate('/')}
                                className="px-6 py-3 bg-white text-zinc-950 border border-stone-200 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-50 transition-all shadow-sm"
                            >
                                New Scan
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    {summary && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                            <div className="bg-zinc-950 p-8 rounded-[32px] text-white shadow-xl">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Total Analysis</span>
                                <div className="text-4xl font-black text-rose-500 leading-tight">
                                    {summary.total_detected} <span className="text-sm font-bold text-white uppercase tracking-tighter">Cells</span>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Malignancy Capture</span>
                                <div className="text-4xl font-black text-zinc-950 leading-tight">
                                    {summary.abnormal_count} <span className="text-sm font-bold text-rose-600 uppercase tracking-tighter">Detected</span>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Erythrocytes</span>
                                <div className="text-4xl font-black text-zinc-950 leading-tight">
                                    {summary.cell_types['RBC'] || 0}
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Leukocytes</span>
                                <div className="text-4xl font-black text-zinc-950 leading-tight">
                                    {summary.cell_types['WBC'] || 0}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No Data Message */}
                    {croppedCells.length === 0 && !summary && (
                        <div className="bg-white rounded-[40px] p-24 text-center border border-stone-200 shadow-sm">
                            <div className="w-20 h-20 bg-stone-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            </div>
                            <p className="text-2xl font-black text-zinc-950 tracking-tight">No clinical data available</p>
                            <p className="text-sm text-slate-400 mt-2 font-medium">
                                Execute an automated scan to populate pathological morphologies
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="mt-8 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-600/20"
                            >
                                Start Analysis
                            </button>
                        </div>
                    )}

                    {/* Cell Grid - Abnormal Cells Display */}
                    {croppedCells.length > 0 && (
                        <div>
                            <div className="mb-6 flex items-center justify-between px-2">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Morphological Abnormalities ({croppedCells.length})</h2>
                                <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-full uppercase tracking-tighter">AI flagged candidates</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {croppedCells.map((cell, idx) => (
                                    <div 
                                        key={cell.id || idx}
                                        className={`rounded-[32px] border overflow-hidden shadow-sm hover:scale-105 transition-all duration-300 ${
                                            getClassificationColor(cell.classification, cell.cell_type)
                                        }`}
                                    >
                                        <div className="aspect-square bg-slate-100 m-2 rounded-[24px] overflow-hidden relative">
                                            {cell.cropped_image ? (
                                                <img
                                                    src={`data:image/png;base64,${cell.cropped_image}`}
                                                    alt={`${cell.cell_type} - ${cell.classification}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 w-6 h-6 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-[10px] font-black text-white">
                                                {getClassificationIcon(cell.classification, cell.cell_type)}
                                            </div>
                                        </div>
                                        <div className="p-4 text-center">
                                            <p className="text-[10px] font-black uppercase tracking-tight truncate">
                                                {cell.cell_type}
                                            </p>
                                            <p className="text-[10px] font-bold opacity-60 tracking-tight truncate uppercase mt-0.5">
                                                {cell.classification || 'Unclassified'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Clinical Note */}
                    <div className="mt-16 bg-white border border-stone-200 p-8 rounded-[32px] shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-600"></div>
                        <h4 className="font-black text-zinc-950 mb-2 text-sm uppercase tracking-tighter">Clinical Compliance Notice</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Malignancy detection and morphological classifications are generated via automated ConvNeXt-V2 neural analysis. 
                            These results are intended for clinical research assistant applications and must be verified by a board-certified hematologist. 
                            Confirm all anomalous findings using peripheral blood film manual microscopy.
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default CellClassifications;
