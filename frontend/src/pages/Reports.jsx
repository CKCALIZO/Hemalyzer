import { useState, useEffect } from "react";
import { Trash2, FileText, Download, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";

export const Reports = () => {
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter reports based on search query (MRN or patient name)
    const filteredReports = reports.filter(report => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const patientName = report.patientData?.name?.toLowerCase() || '';
        const patientId = report.patientData?.id?.toLowerCase() || '';
        return patientName.includes(query) || patientId.includes(query);
    });

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

    // Robust Clinical Analysis Helper
    const getClinicalAnalysis = (type, status) => {
        const analyses = {
            'Neutrophil': {
                high: {
                    interpretation: 'Neutrophilia: Increased neutrophils often indicate acute bacterial infection, severe stress, burns, or tissue necrosis.',
                    recommendation: 'Clinical Recommendation: Evaluate for signs of infection (fever, localized pain). Consider CBC with differential repeats and inflammatory markers (CRP, ESR).'
                },
                low: {
                    interpretation: 'Neutropenia: Decreased neutrophils significantly increase infection risk. May be caused by viral infections, chemotherapy, aplastic anemia, or severe overwhelming infection (sepsis).',
                    recommendation: 'Clinical Recommendation: Urgent clinical assessment for infection. Review medication history (look for marrow-suppressive drugs). Hematology consultation recommended if persistent or severe (<1000/µL).'
                },
                normal: {
                    interpretation: 'Neutrophil count is within the healthy reference range, suggesting adequate innate immune function against bacteria.',
                    recommendation: 'Clinical Recommendation: Routine monitoring as part of standard wellness checks.'
                }
            },
            'Lymphocyte': {
                high: {
                    interpretation: 'Lymphocytosis: Elevated lymphocytes are common in viral infections (Epstein-Barr, Cytomegalovirus), chronic lymphocytic leukemia (CLL), or pertussis.',
                    recommendation: 'Clinical Recommendation: Assess for viral symptoms (sore throat, lymphadenopathy). If elderly or asymptomatic, rule out lymphoproliferative disorders (CLL).'
                },
                low: {
                    interpretation: 'Lymphocytopenia: Decreased lymphocytes may be seen in HIV/AIDS, high-dose steroid therapy, autoimmune diseases (Lupus), or acute stress response.',
                    recommendation: 'Clinical Recommendation: detailed history taking for autoimmune symptoms or immunodeficiency risk factors. Consider HIV screening if clinically indicated.'
                },
                normal: {
                    interpretation: 'Lymphocyte count is within the healthy reference range, indicating normal adaptive immune capacity.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            },
            'Monocyte': {
                high: {
                    interpretation: 'Monocytosis: Often associated with chronic infections (Tuberculosis, fungal), bacterial endocarditis, recovery phase of acute infections, or autoimmune disorders.',
                    recommendation: 'Clinical Recommendation: Evaluate for chronic inflammatory conditions. If persistent, consider screening for chronic infections or myelomonocytic leukemia in elderly patients.'
                },
                low: {
                    interpretation: 'Monocytopenia: Rare. Can be associated with hairy cell leukemia, severe aplastic anemia, or acute stress.',
                    recommendation: 'Clinical Recommendation: Usually not clinically significant in isolation. Monitor trend. Review peripheral smear for hairy cells.'
                },
                normal: {
                    interpretation: 'Monocyte count is within the healthy reference range.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            },
            'Eosinophil': {
                high: {
                    interpretation: 'Eosinophilia: Strongly suggestive of allergic conditions (asthma, eczema), parasitic infections (worms), or drug hypersensitivity.',
                    recommendation: 'Clinical Recommendation: Review allergy history and medications. Consider stool ova/parasite exam if travel history is relevant. Screen for asthma.'
                },
                low: {
                    interpretation: 'Eosinopenia: Often occurs during acute adrenal stress (Cushing’s syndrome), severe acute infection, or corticosteroid use.',
                    recommendation: 'Clinical Recommendation: Usually transient and responsive to stress/infection resolution. No specific intervention typically needed unless Cushing’s suspected.'
                },
                normal: {
                    interpretation: 'Eosinophil count is within the healthy reference range.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            },
            'Basophil': {
                high: {
                    interpretation: 'Basophilia: Uncommon. Can be a marker for Chronic Myeloid Leukemia (CML) or other myeloproliferative neoplasms. Also seen in hypersensitivity reactions.',
                    recommendation: 'Clinical Recommendation: IMPORTANT: Rule out myeloproliferative disorders (CML). Check for splenomegaly. Hematology referral suggested if persistent.'
                },
                low: {
                    interpretation: 'Basopenia: Difficult to demonstrate as normal count is low. May be seen in acute phase of infection, hyperthyroidism, or stress.',
                    recommendation: 'Clinical Recommendation: Generally not clinically significant.'
                },
                normal: {
                    interpretation: 'Basophil count is within the healthy reference range.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            }
        };
        return analyses[type]?.[status] || {
            interpretation: 'Clinical correlation recommended.',
            recommendation: 'Clinical Recommendation: Correlate with clinical findings.'
        };
    };

    const handleDownloadPDF = (report) => {
        generatePDF(report);
    };

    const PieChart = ({ data }) => {
        if (!data || Object.keys(data).length === 0) return <div className="text-gray-400 text-xs">No data for chart</div>;

        const total = Object.values(data).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
        if (total === 0) return <div className="text-gray-400 text-xs">No count data</div>;

        let cumulativePercent = 0;

        // Sort for better visualization
        const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
        // Colors palette - classification specific colors
        const colorMap = {
            'Normal WBC': '#10B981',  // green
            'Normal RBC': '#06B6D4',  // cyan
            'Acute Lymphoblastic Leukemia': '#EF4444', // red
            'Acute Myeloid Leukemia': '#F97316', // orange
            'Chronic Lymphocytic Leukemia': '#8B5CF6', // purple
            'Chronic Myeloid Leukemia': '#F59E0B', // amber
            'Sickle Cell Anemia': '#EC4899', // pink
        };
        const defaultColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#64748B'];

        const getCoordinatesForPercent = (percent) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        // Format label for display (e.g., "Neutrophil: Normal" -> "Neutrophil:\nNormal")
        const formatLabel = (label) => {
            if (label.includes(':')) {
                const [cellType, condition] = label.split(':').map(s => s.trim());
                return { cellType, condition };
            }
            return { cellType: label, condition: null };
        };

        const getColorForLabel = (label, index) => {
            const lowerLabel = label.toLowerCase();
            for (const [key, color] of Object.entries(colorMap)) {
                if (lowerLabel.includes(key)) return color;
            }
            return defaultColors[index % defaultColors.length];
        };

        const slices = sortedData.map(([label, value], i) => {
            const percent = value / total;
            const startPercent = cumulativePercent;
            cumulativePercent += percent;
            const endPercent = cumulativePercent;

            const [startX, startY] = getCoordinatesForPercent(startPercent);
            const [endX, endY] = getCoordinatesForPercent(endPercent);

            const largeArcFlag = percent > 0.5 ? 1 : 0;
            const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;

            return { path: pathData, color: getColorForLabel(label, i), label, value, percent, ...formatLabel(label) };
        });

        return (
            <div className="flex items-start gap-4">
                <div className="relative w-28 h-28 shrink-0">
                    <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                        {slices.map((slice, i) => (
                            <path key={i} d={slice.path} fill={slice.color} stroke="white" strokeWidth="0.05">
                                <title>{`${slice.label}: ${slice.value}`}</title>
                            </path>
                        ))}
                    </svg>
                </div>
                <div className="text-xs space-y-1.5 flex-1">
                    {slices.map((slice, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: slice.color }}></span>
                            <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-700 block truncate" title={slice.label}>
                                    {slice.cellType}{slice.condition ? ':' : ''}
                                </span>
                                {slice.condition && (
                                    <span className="text-slate-500 block truncate">{slice.condition}</span>
                                )}
                            </div>
                            <span className="text-slate-600 font-semibold shrink-0">{Math.round(slice.percent * 100)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen bg-red-50">
            <Sidebar />
            <div className="flex flex-col flex-1 transition-all duration-300">
                <Header />
                <main className="flex grow flex-col items-start justify-start p-8">
                    <div className="w-full max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-4xl font-bold text-red-900">Analysis Reports</h1>
                            {reports.length > 0 && (
                                <button
                                    onClick={clearAllReports}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Clear All Reports
                                </button>
                            )}
                        </div>

                        {reports.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-lg border border-red-200">
                                <p className="text-xl text-red-600">No reports saved yet</p>
                            <p className="text-sm text-red-400 mt-2">Analyze an image and save the report to view it here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Reports List */}
                            <div className="lg:col-span-1 space-y-4">
                                <h2 className="text-xl font-semibold mb-4 text-red-900">Saved Reports ({reports.length})</h2>
                                
                                {/* Search Bar */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-red-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by MRN or patient name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-sm placeholder-red-300"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-red-400 hover:text-red-600"
                                        >
                                            <span className="text-lg">&times;</span>
                                        </button>
                                    )}
                                </div>
                                
                                {/* Search Results Count */}
                                {searchQuery && (
                                    <p className="text-xs text-red-500">
                                        Found {filteredReports.length} of {reports.length} reports
                                    </p>
                                )}
                                
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {filteredReports.length === 0 ? (
                                        <div className="text-center py-8 text-red-400">
                                            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No reports match your search</p>
                                        </div>
                                    ) : (
                                        filteredReports.map((report) => (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${selectedReport?.id === report.id
                                                ? 'border-red-600 bg-red-50'
                                                : 'border-red-200 hover:border-red-400 bg-white'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-sm text-red-800">
                                                        {report.patientData?.name || 'Unknown Patient'}
                                                    </p>
                                                    <p className="text-xs text-red-600 font-mono">
                                                        MRN: {report.patientData?.id || 'N/A'}
                                                    </p>
                                                    <p className="text-xs text-red-500">{report.timestamp}</p>
                                                    <div className="mt-2 text-xs text-red-600">
                                                        <span className="font-medium">
                                                            Total: {report.summary?.totalCells || report.data.stage1_detection?.total || 0} cells
                                                        </span>
                                                        {report.summary && (
                                                            <div className="mt-1 space-y-1">
                                                                <div>WBC: {report.summary.wbcCount}, RBC: {report.summary.rbcCount}</div>
                                                                <div>Images: {report.summary.imagesAnalyzed || report.imagesCount}/10</div>
                                                                {report.summary.estimatedWBCCount > 0 && (
                                                                    <div className="text-blue-600 font-medium">
                                                                        Est. WBC: {report.summary.estimatedWBCCount.toLocaleString()}/μL
                                                                    </div>
                                                                )}
                                                                {report.summary.estimatedRBCCount > 0 && (
                                                                    <div className="text-red-600 font-medium">
                                                                        Est. RBC: {(report.summary.estimatedRBCCount / 1e6).toFixed(2)}M/μL
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteReport(report.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                    )}
                                </div>
                            </div>

                            {/* Report Details */}
                            <div className="lg:col-span-2">
                                {selectedReport ? (
                                    <div className="bg-white rounded-lg border border-red-200 p-6 shadow-sm">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h2 className="text-2xl font-bold text-red-900">
                                                    {selectedReport.patientData?.name || 'Unknown Patient'} - Analysis Report
                                                </h2>
                                                <p className="text-sm text-red-600 font-mono mt-1">
                                                    MRN: {selectedReport.patientData?.id || 'N/A'}
                                                </p>
                                                <p className="text-sm text-red-500 mt-1">{selectedReport.timestamp}</p>
                                            </div>
                                            <button
                                                onClick={() => generatePDF(selectedReport)}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Save as PDF
                                            </button>
                                        </div>

                                        {/* Patient Information Section */}
                                        {selectedReport.patientData && (
                                            <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                                                <h3 className="font-semibold text-lg mb-3 text-slate-800 flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Patient Information
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                        <p className="text-xs text-slate-500">Name</p>
                                                        <p className="font-medium text-slate-800">{selectedReport.patientData.name || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                        <p className="text-xs text-slate-500">Patient ID</p>
                                                        <p className="font-medium text-slate-800 font-mono">{selectedReport.patientData.id || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                        <p className="text-xs text-slate-500">Demographics</p>
                                                        <p className="font-medium text-slate-800">
                                                            {selectedReport.patientData.age ? `${selectedReport.patientData.age} yrs` : 'Age N/A'} • {selectedReport.patientData.gender || 'N/A'}
                                                        </p>
                                                    </div>
                                                    {selectedReport.patientData.phone && (
                                                        <div className="bg-white p-3 rounded border border-slate-200">
                                                            <p className="text-xs text-slate-500">Contact</p>
                                                            <p className="font-medium text-slate-800">{selectedReport.patientData.phone}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}



                                        {/* Cell Detection Summary */}
                                        <div className="bg-slate-50 p-4 rounded-lg mb-6">
                                            <h3 className="font-semibold text-lg mb-3 text-slate-800">Cell Detection Summary</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Total Cells</p>
                                                    <p className="text-2xl font-bold text-slate-700">
                                                        {selectedReport.summary?.totalCells || selectedReport.data.stage1_detection?.total || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Red Blood Cells</p>
                                                    <p className="text-2xl font-bold text-red-600">
                                                        {selectedReport.summary?.rbcCount || selectedReport.data.stage1_detection?.counts?.RBC || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">White Blood Cells</p>
                                                    <p className="text-2xl font-bold text-green-600">
                                                        {selectedReport.summary?.wbcCount || selectedReport.data.stage1_detection?.counts?.WBC || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Platelets</p>
                                                    <p className="text-2xl font-bold text-amber-600">
                                                        {selectedReport.summary?.plateletCount || selectedReport.data.stage1_detection?.counts?.Platelets || 0}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Estimated Counts Section */}
                                            {selectedReport.summary && (selectedReport.summary.estimatedWBCCount > 0 || selectedReport.summary.estimatedRBCCount > 0) && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <h4 className="font-semibold text-md mb-3 text-slate-800">Estimated Cell Concentrations</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {selectedReport.summary.estimatedWBCCount > 0 && (
                                                            <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                                                <p className="text-sm text-blue-600">Estimated WBC Count</p>
                                                                <p className="text-xl font-bold text-blue-700">
                                                                    {selectedReport.summary.estimatedWBCCount.toLocaleString()} cells/μL
                                                                </p>
                                                                <p className="text-xs text-blue-500 mt-1">
                                                                    Formula: (Total WBC / 10) × 2,000
                                                                </p>
                                                            </div>
                                                        )}
                                                        {selectedReport.summary.estimatedRBCCount > 0 && (
                                                            <div className="bg-red-50 p-3 rounded border border-red-200">
                                                                <p className="text-sm text-red-600">Estimated RBC Count</p>
                                                                <p className="text-xl font-bold text-red-700">
                                                                    {(selectedReport.summary.estimatedRBCCount / 1e6).toFixed(2)} × 10⁶ cells/μL
                                                                </p>
                                                                <p className="text-xs text-red-500 mt-1">
                                                                    Formula: (Average RBC per image ÷ 10) × 200,000
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* WBC Classification Summary */}
                                        {selectedReport.data?.classificationCounts && Object.keys(selectedReport.data.classificationCounts).length > 0 && (
                                            <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                                                <h3 className="font-semibold text-lg mb-3 text-blue-800">WBC Classification</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {Object.entries(selectedReport.data.classificationCounts).map(([className, count]) => (
                                                        <div key={className} className={`bg-white p-3 rounded border ${count > 0 && className !== 'Normal WBC' ? 'border-red-200' : 'border-blue-100'}`}>
                                                            <p className={`text-xs font-medium ${count > 0 && className !== 'Normal WBC' ? 'text-red-600' : 'text-blue-600'}`}>{className}</p>
                                                            <p className={`text-lg font-bold ${count > 0 && className !== 'Normal WBC' ? 'text-red-800' : 'text-blue-800'}`}>{count}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cell Classification Summary & Pie Chart */}
                                        <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
                                            <div className="flex flex-col md:flex-row gap-6">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-lg mb-3 text-amber-800">Cell Classification Summary</h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-white p-3 rounded border border-red-200">
                                                            <p className="text-sm text-red-600">Disease WBCs</p>
                                                            <p className="text-2xl font-bold text-red-700">{selectedReport.data?.diseaseWBCCount || selectedReport.data?.abnormalWBCs || 0}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border border-green-200">
                                                            <p className="text-sm text-green-600">Normal WBCs</p>
                                                            <p className="text-2xl font-bold text-green-700">{selectedReport.data?.normalWBCCount || ((selectedReport.summary?.wbcCount || 0) - (selectedReport.data?.diseaseWBCCount || selectedReport.data?.abnormalWBCs || 0))}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border border-red-200">
                                                            <p className="text-sm text-red-600">Sickle Cells</p>
                                                            <p className="text-2xl font-bold text-red-700">{selectedReport.data?.sickleCount || selectedReport.summary?.sickleCount || 0}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border border-slate-200">
                                                            <p className="text-sm text-slate-600">Analyzed Images</p>
                                                            <p className="text-2xl font-bold text-slate-700">{selectedReport.summary?.imagesAnalyzed || selectedReport.sessionData?.totalImagesAnalyzed || selectedReport.imagesCount || 10}/10</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="md:w-2/5 md:border-l border-amber-200 md:pl-6">
                                                    <h4 className="font-semibold text-sm mb-3 text-amber-900">Classification Breakdown</h4>
                                                    <PieChart data={selectedReport.data?.classificationCounts} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Disease Findings / Patient Condition */}
                                        {selectedReport.data?.diseaseFindings && selectedReport.data.diseaseFindings.length > 0 && (
                                            <div className="bg-rose-50 p-4 rounded-lg mb-6 border border-rose-200">
                                                <h3 className="font-semibold text-lg mb-3 text-rose-800">Patient Condition Assessment</h3>
                                                <div className="space-y-3">
                                                    {selectedReport.data.diseaseFindings.map((finding, idx) => (
                                                        <div key={idx} className="bg-white p-4 rounded-lg border border-rose-200">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="font-bold text-rose-800 text-lg">{finding.condition || finding.name}</span>
                                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${finding.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                                                                    finding.severity === 'MODERATE' ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    {finding.severity || 'DETECTED'}
                                                                </span>
                                                            </div>
                                                            {finding.confidence && (
                                                                <p className="text-sm text-slate-600">
                                                                    Confidence: {(finding.confidence * 100).toFixed(1)}%
                                                                </p>
                                                            )}
                                                            {finding.description && (
                                                                <p className="text-sm text-slate-600 mt-1">{finding.description}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Analysis Summary */}
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-3 text-slate-800">Analysis Summary</h3>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex justify-between text-slate-700">
                                                    <span>Analysis Date:</span>
                                                    <span>{selectedReport.timestamp}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-700">
                                                    <span>Analysis Status:</span>
                                                    <span className={`font-semibold ${selectedReport.sessionData?.analysisComplete ? 'text-green-600' : 'text-amber-600'}`}>
                                                        {selectedReport.sessionData?.analysisComplete ? 'Complete' : 'In Progress'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-slate-700">
                                                    <span>Total Cells Detected:</span>
                                                    <span className="font-semibold">{selectedReport.summary?.totalCells || 0}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-700">
                                                    <span>WBC Classifications:</span>
                                                    <span className="font-semibold">{selectedReport.sessionData?.wbcClassificationCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Clinical Interpretation */}
                                        {selectedReport.data?.disease_interpretation && (
                                            <div className="mt-6 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                                                <h3 className="font-semibold text-lg mb-3 text-slate-800">Clinical Thresholds & Interpretation</h3>
                                                <ThresholdResults
                                                    diseaseInterpretation={selectedReport.data.disease_interpretation}
                                                    clinicalThresholds={selectedReport.data.clinical_thresholds}
                                                />
                                            </div>
                                        )}

                                        {/* Clinical Note */}
                                        <div className="mt-6 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                                            <p className="font-semibold text-slate-700">Clinical Note:</p>
                                            <p className="text-sm text-slate-600 mt-1">
                                                This is a research tool for educational purposes. Results should be validated by trained
                                                hematologists and confirmed with additional diagnostic tests.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-lg p-16 text-center">
                                        <p className="text-slate-500">Select a report from the list to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    </div>
                </main>
                <Footer />
            </div>
        </div>
    )
}