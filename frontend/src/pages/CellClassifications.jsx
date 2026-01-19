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

    // Filter cells based on selected filter
    const getFilteredCells = () => {
        if (filter === 'all') return croppedCells;
        if (filter === 'wbc') return croppedCells.filter(c => c.cell_type === 'WBC');
        if (filter === 'rbc') return croppedCells.filter(c => c.cell_type === 'RBC');
        if (filter === 'abnormal') return croppedCells.filter(c => c.is_abnormal);
        return croppedCells;
    };

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

    const filteredCells = getFilteredCells();

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

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-4 rounded-lg border border-red-200">
                                <p className="text-sm text-red-600">Total Classified</p>
                                <p className="text-2xl font-bold text-red-800">{croppedCells.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-red-200">
                                <p className="text-sm text-red-600">WBC Classifications</p>
                                <p className="text-2xl font-bold text-red-800">
                                    {croppedCells.filter(c => c.cell_type === 'WBC').length}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-red-200">
                                <p className="text-sm text-red-600">Sickle Cells</p>
                                <p className="text-2xl font-bold text-red-800">
                                    {summary.sickle_cell_count || 0}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-red-200">
                                <p className="text-sm text-red-600">Abnormal WBCs</p>
                                <p className="text-2xl font-bold text-red-800">
                                    {summary.abnormal_wbc_count || 0}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Filter Buttons */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'all' 
                                    ? 'bg-red-700 text-white' 
                                    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                            }`}
                        >
                            All Cells ({croppedCells.length})
                        </button>
                        <button
                            onClick={() => setFilter('wbc')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'wbc' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                            }`}
                        >
                            WBCs ({croppedCells.filter(c => c.cell_type === 'WBC').length})
                        </button>
                        <button
                            onClick={() => setFilter('rbc')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'rbc' 
                                    ? 'bg-red-800 text-white' 
                                    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                            }`}
                        >
                            Sickle Cells ({croppedCells.filter(c => c.cell_type === 'RBC').length})
                        </button>
                        <button
                            onClick={() => setFilter('abnormal')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'abnormal' 
                                    ? 'bg-red-900 text-white' 
                                    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                            }`}
                        >
                            Abnormal Only ({croppedCells.filter(c => c.is_abnormal).length})
                        </button>
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

                    {/* Cell Grid */}
                    {filteredCells.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filteredCells.map((cell, idx) => (
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
