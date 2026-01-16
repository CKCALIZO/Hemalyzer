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

    // Get color class based on classification
    const getClassificationColor = (classification, cellType) => {
        if (cellType === 'RBC') {
            return 'bg-red-100 border-red-500 text-red-800';
        }
        if (classification === 'Normal') {
            return 'bg-green-100 border-green-500 text-green-800';
        }
        // Abnormal WBC (leukemia types)
        return 'bg-orange-100 border-orange-500 text-orange-800';
    };

    // Get icon based on classification
    const getClassificationIcon = (classification, cellType) => {
        if (cellType === 'RBC') return '🔴';
        if (classification === 'Normal') return '✅';
        return '⚠️';
    };

    const filteredCells = getFilteredCells();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex grow flex-col p-8">
                <div className="max-w-7xl mx-auto w-full">
                    {/* Header Section */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Cell Classifications</h1>
                            <p className="text-gray-600 mt-1">
                                ConvNeXt Model Classification Results
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/', {
                                state: {
                                    results: location.state?.results,
                                    previewUrl: location.state?.previewUrl
                                }
                            })}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                        >
                            ← Back to Results
                        </button>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-600">Total Classified</p>
                                <p className="text-2xl font-bold text-blue-800">{croppedCells.length}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <p className="text-sm text-green-600">WBC Classifications</p>
                                <p className="text-2xl font-bold text-green-800">
                                    {croppedCells.filter(c => c.cell_type === 'WBC').length}
                                </p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                <p className="text-sm text-red-600">Sickle Cells</p>
                                <p className="text-2xl font-bold text-red-800">
                                    {summary.sickle_cell_count || 0}
                                </p>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                <p className="text-sm text-orange-600">Abnormal WBCs</p>
                                <p className="text-2xl font-bold text-orange-800">
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
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            All Cells ({croppedCells.length})
                        </button>
                        <button
                            onClick={() => setFilter('wbc')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'wbc' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            WBCs ({croppedCells.filter(c => c.cell_type === 'WBC').length})
                        </button>
                        <button
                            onClick={() => setFilter('rbc')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'rbc' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Sickle Cells ({croppedCells.filter(c => c.cell_type === 'RBC').length})
                        </button>
                        <button
                            onClick={() => setFilter('abnormal')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                filter === 'abnormal' 
                                    ? 'bg-orange-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Abnormal Only ({croppedCells.filter(c => c.is_abnormal).length})
                        </button>
                    </div>

                    {/* No Data Message */}
                    {croppedCells.length === 0 && (
                        <div className="bg-gray-50 rounded-lg p-16 text-center">
                            <p className="text-xl text-gray-500">No cell classifications available</p>
                            <p className="text-sm text-gray-400 mt-2">
                                Analyze an image first to see cell classification results
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                                    className={`rounded-lg border-2 overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                                        getClassificationColor(cell.classification, cell.cell_type)
                                    }`}
                                >
                                    {/* Cell Image */}
                                    <div className="aspect-square bg-gray-100">
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
                                            <span className="text-lg">
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
                        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
                            <h2 className="text-xl font-bold mb-4">Detailed WBC Classifications</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="text-left p-3">ID</th>
                                            <th className="text-left p-3">Classification</th>
                                            <th className="text-left p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {wbcClassifications.map((wbc) => (
                                            <tr key={wbc.wbc_id} className="border-b hover:bg-gray-50">
                                                <td className="p-3 font-mono">WBC #{wbc.wbc_id}</td>
                                                <td className="p-3 font-semibold">{wbc.classification}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        wbc.classification === 'Normal'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                        {wbc.classification === 'Normal' ? '✓ Normal' : '⚠ Abnormal'}
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
                    <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <p className="font-semibold text-yellow-800">⚠️ Clinical Note:</p>
                        <p className="text-sm text-yellow-700 mt-1">
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
