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
            return 'bg-red-50 border-red-400 text-red-800';
        }
        if (classification === 'Normal') {
            return 'bg-green-50 border-green-400 text-green-800';
        }
        // Abnormal WBC (leukemia types)
        return 'bg-amber-50 border-amber-400 text-amber-800';
    };

    // Get icon based on classification
    const getClassificationIcon = (classification, cellType) => {
        if (cellType === 'RBC') return '●';
        if (classification === 'Normal') return '✓';
        return '!';
    };

    return (
        <div className="flex flex-col min-h-screen bg-red-50">
            <Header />
            <main className="flex grow flex-col p-8">
                <div className="max-w-7xl mx-auto w-full">
                    {/* Header Section */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-red-900">Cell Classifications</h1>
                            <p className="text-red-700 mt-1">
                                ConvNeXt Model Classification Results
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/', {
                                state: {
                                    results: location.state?.results,
                                    previewUrl: location.state?.previewUrl,
                                    sessionState: location.state?.sessionState
                                }
                            })}
                            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-semibold"
                        >
                            Back to Results
                        </button>
                    </div>

                    {/* Summary removed - stats now shown in Quick Stats section below */}

                    {/* Info Banner - Only Abnormal Cells Displayed */}
                    <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <h3 className="font-semibold text-amber-800 mb-1">Abnormal Cells Only</h3>
                                <p className="text-sm text-amber-700">
                                    This page displays only abnormal/diseased cells detected by the ConvNeXt model. Normal WBCs, RBCs, and Platelets are automatically filtered out. 
                                    Showing: <span className="font-semibold">Abnormal WBCs</span> and <span className="font-semibold">Sickle Cells</span> (≥80% confidence).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="mb-6 grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border-l-4 border-rose-500">
                            <p className="text-sm text-rose-600 font-medium">Total Abnormal</p>
                            <p className="text-2xl font-bold text-rose-800">{croppedCells.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-blue-600 font-medium">Abnormal WBCs</p>
                            <p className="text-2xl font-bold text-blue-800">{croppedCells.filter(c => c.cell_type === 'WBC').length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border-l-4 border-red-600">
                            <p className="text-sm text-red-600 font-medium">Sickle Cells</p>
                            <p className="text-2xl font-bold text-red-800">{croppedCells.filter(c => c.cell_type === 'RBC').length}</p>
                        </div>
                    </div>

                    {/* No Data Message */}
                    {croppedCells.length === 0 && (
                        <div className="bg-white rounded-lg p-16 text-center border border-red-200">
                            <p className="text-xl text-red-600">No cell classifications available</p>
                            <p className="text-sm text-red-400 mt-2">
                                Analyze an image first to see cell classification results
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="mt-4 px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
                            >
                                Go to Analysis
                            </button>
                        </div>
                    )}

                    {/* Cell Grid - All Abnormal Cells */}
                    {croppedCells.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {croppedCells.map((cell, idx) => (
                                <div 
                                    key={cell.id || idx}
                                    className={`rounded-lg border-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                                        getClassificationColor(cell.classification, cell.cell_type)
                                    }`}
                                >
                                    {/* Cell Image */}
                                    <div className="aspect-square bg-slate-100">
                                        <img
                                            src={`data:image/png;base64,${cell.cropped_image}`}
                                            alt={`${cell.cell_type} - ${cell.classification}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    
                                    {/* Cell Info */}
                                    <div className="p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold uppercase tracking-wide">
                                                {cell.cell_type}
                                            </span>
                                            <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">
                                                {getClassificationIcon(cell.classification, cell.cell_type)}
                                            </span>
                                        </div>
                                        <p className="font-bold text-sm" title={cell.classification}>
                                            Classified: {cell.classification}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* WBC Classification Summary Table */}
                    {wbcClassifications.length > 0 && (
                        <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">Detailed WBC Classifications</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left p-3 text-slate-700">ID</th>
                                            <th className="text-left p-3 text-slate-700">Classification</th>
                                            <th className="text-left p-3 text-slate-700">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {wbcClassifications.map((wbc) => (
                                            <tr key={wbc.wbc_id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="p-3 font-mono text-slate-700">WBC #{wbc.wbc_id}</td>
                                                <td className="p-3 font-semibold text-slate-800">{wbc.classification}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        wbc.classification === 'Normal'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {wbc.classification === 'Normal' ? '✓ Normal' : '! Abnormal'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Clinical Note */}
                    <div className="mt-6 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        <p className="font-semibold text-slate-700">Clinical Note:</p>
                        <p className="text-sm text-slate-600 mt-1">
                            These classifications are generated by a ConvNeXt deep learning model for research 
                            and educational purposes. Results should be validated by trained hematologists 
                            and confirmed with additional diagnostic tests before any clinical decisions.
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default CellClassifications;
