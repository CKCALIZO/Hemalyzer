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
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex grow flex-col items-start justify-start p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-4xl font-bold text-gray-800">Analysis Reports</h1>
                        {reports.length > 0 && (
                            <button
                                onClick={clearAllReports}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                                Clear All Reports
                            </button>
                        )}
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 rounded-lg">
                            <p className="text-xl text-gray-500">No reports saved yet</p>
                            <p className="text-sm text-gray-400 mt-2">Analyze an image and save the report to view it here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Reports List */}
                            <div className="lg:col-span-1 space-y-4">
                                <h2 className="text-xl font-semibold mb-4">Saved Reports ({reports.length})</h2>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {reports.map((report) => (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${
                                                selectedReport?.id === report.id
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-blue-300 bg-white'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-sm">Report #{report.id}</p>
                                                    <p className="text-xs text-gray-500">{report.timestamp}</p>
                                                    <div className="mt-2 text-xs">
                                                        <span className="font-medium">Total: {report.data.stage1_detection?.total || 0} cells</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteReport(report.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Report Details */}
                            <div className="lg:col-span-2">
                                {selectedReport ? (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h2 className="text-2xl font-bold mb-4">Report #{selectedReport.id}</h2>
                                        <p className="text-sm text-gray-500 mb-6">{selectedReport.timestamp}</p>

                                        {/* Annotated Image */}
                                        {selectedReport.data.annotated_image && (
                                            <div className="mb-6">
                                                <h3 className="font-semibold text-lg mb-2">Annotated Image</h3>
                                                <img
                                                    src={`data:image/jpeg;base64,${selectedReport.data.annotated_image}`}
                                                    alt="Analysis Result"
                                                    className="w-full rounded-lg border border-gray-300"
                                                />
                                            </div>
                                        )}

                                        {/* Cell Detection Summary */}
                                        <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                            <h3 className="font-semibold text-lg mb-3">Cell Detection Summary</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white p-3 rounded">
                                                    <p className="text-sm text-gray-600">Total Cells</p>
                                                    <p className="text-2xl font-bold text-blue-600">
                                                        {selectedReport.data.stage1_detection?.total || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded">
                                                    <p className="text-sm text-gray-600">Red Blood Cells</p>
                                                    <p className="text-2xl font-bold text-red-600">
                                                        {selectedReport.data.stage1_detection?.counts?.RBC || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded">
                                                    <p className="text-sm text-gray-600">White Blood Cells</p>
                                                    <p className="text-2xl font-bold text-green-600">
                                                        {selectedReport.data.stage1_detection?.counts?.WBC || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded">
                                                    <p className="text-sm text-gray-600">Platelets</p>
                                                    <p className="text-2xl font-bold text-yellow-600">
                                                        {selectedReport.data.stage1_detection?.counts?.Platelets || 0}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detailed Metrics */}
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-3">Detection Metrics</h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span>Detection Model:</span>
                                                    <span className="font-mono">Roboflow bloodcell-hema/5</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Confidence Threshold:</span>
                                                    <span className="font-mono">20%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Overlap Threshold:</span>
                                                    <span className="font-mono">20%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Analysis Date:</span>
                                                    <span>{selectedReport.timestamp}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Clinical Interpretation */}
                                        {selectedReport.data?.disease_interpretation && (
                                            <div className="mt-6 bg-green-50 border border-green-200 p-4 rounded-lg">
                                                <h3 className="font-semibold text-lg mb-3 text-green-800">🩺 Clinical Thresholds & Interpretation</h3>
                                                <ThresholdResults 
                                                    diseaseInterpretation={selectedReport.data.disease_interpretation}
                                                    clinicalThresholds={selectedReport.data.clinical_thresholds}
                                                />
                                            </div>
                                        )}

                                        {/* Clinical Note */}
                                        <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                                            <p className="font-semibold text-yellow-800">⚠️ Clinical Note:</p>
                                            <p className="text-sm text-yellow-700 mt-1">
                                                This is a research tool for educational purposes. Results should be validated by trained
                                                hematologists and confirmed with additional diagnostic tests.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 rounded-lg p-16 text-center">
                                        <p className="text-gray-500">Select a report from the list to view details</p>
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