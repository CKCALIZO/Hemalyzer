import { useState, useEffect } from "react";
import { Header } from "../components/Header.jsx";
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

    return (
        <div className="flex flex-col min-h-screen bg-red-50">
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
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {reports.map((report) => (
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
                                                    <p className="font-semibold text-sm text-red-800">Report #{report.id}</p>
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
                                    ))}
                                </div>
                            </div>

                            {/* Report Details */}
                            <div className="lg:col-span-2">
                                {selectedReport ? (
                                    <div className="bg-white rounded-lg border border-red-200 p-6 shadow-sm">
                                        <h2 className="text-2xl font-bold mb-4 text-red-900">Report #{selectedReport.id}</h2>
                                        <p className="text-sm text-red-500 mb-6">{selectedReport.timestamp}</p>

                                        {/* Annotated Image */}
                                        {selectedReport.data.annotated_image && (
                                            <div className="mb-6">
                                                <h3 className="font-semibold text-lg mb-2 text-slate-800">Annotated Image</h3>
                                                <img
                                                    src={`data:image/jpeg;base64,${selectedReport.data.annotated_image}`}
                                                    alt="Analysis Result"
                                                    className="w-full rounded-lg border border-slate-300"
                                                />
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

                                        {/* WBC Differential Counts */}
                                        {selectedReport.data?.wbcDifferential && Object.keys(selectedReport.data.wbcDifferential).length > 0 && (
                                            <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                                                <h3 className="font-semibold text-lg mb-3 text-blue-800">WBC Differential Count</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    {Object.entries(selectedReport.data.wbcDifferential).map(([cellType, data]) => (
                                                        <div key={cellType} className="bg-white p-3 rounded border border-blue-100">
                                                            <p className="text-xs text-blue-600 font-medium">{cellType}</p>
                                                            <p className="text-lg font-bold text-blue-800">{data.percentage?.toFixed(1) || 0}%</p>
                                                            <p className="text-xs text-slate-500">({data.count || 0} cells)</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Abnormal Cells Summary */}
                                        <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
                                            <h3 className="font-semibold text-lg mb-3 text-amber-800">Cell Classification Summary</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white p-3 rounded border border-amber-200">
                                                    <p className="text-sm text-amber-600">Abnormal WBCs</p>
                                                    <p className="text-2xl font-bold text-amber-700">
                                                        {selectedReport.data?.abnormalWBCs || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-green-200">
                                                    <p className="text-sm text-green-600">Normal WBCs</p>
                                                    <p className="text-2xl font-bold text-green-700">
                                                        {(selectedReport.summary?.wbcCount || 0) - (selectedReport.data?.abnormalWBCs || 0)}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-red-200">
                                                    <p className="text-sm text-red-600">Sickle Cells</p>
                                                    <p className="text-2xl font-bold text-red-700">
                                                        {selectedReport.data?.sickleCount || selectedReport.summary?.sickleCount || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Images Analyzed</p>
                                                    <p className="text-2xl font-bold text-slate-700">
                                                        {selectedReport.sessionData?.totalImagesAnalyzed || selectedReport.imagesCount || 0}/10
                                                    </p>
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
    )
}