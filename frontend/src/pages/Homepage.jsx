import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";
import { DiseaseInterpretation } from "../components/DiseaseInterpretation.jsx";

const API_URL = 'http://localhost:5000';

const Homepage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [showMetrics, setShowMetrics] = useState(false);

    // Restore state when navigating back from classifications
    useEffect(() => {
        if (location.state?.results) {
            setResults(location.state.results);
            setPreviewUrl(location.state.previewUrl);
        }
    }, [location.state]);

    // Handle file selection
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResults(null);
            setError(null);
        }
    };

    // Handle upload and analysis
    const handleAnalyze = async () => {
        console.log('🔵 handleAnalyze called!');
        console.log('🔵 selectedFile:', selectedFile);
        
        if (!selectedFile) {
            console.error('❌ No file selected');
            setError('Please select an image first');
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);
        setShowMetrics(false);

        try {
            console.log('📤 Sending request to:', `${API_URL}/api/analyze`);
            console.log('📤 File name:', selectedFile.name);
            console.log('📤 File size:', selectedFile.size, 'bytes');
            
            const formData = new FormData();
            formData.append('image', selectedFile);
            // DETECTION SETTINGS:
            // - conf_threshold: 0.2 (20% confidence)
            // - iou_threshold: 0.2 (20% overlap threshold)
            formData.append('conf_threshold', '0.2');
            formData.append('iou_threshold', '0.2');

            console.log('📤 FormData created, making fetch request...');
            
            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                body: formData,
            });

            console.log('📥 Response received!');
            console.log('📥 Response status:', response.status);
            console.log('📥 Response ok:', response.ok);
            
            const data = await response.json();
            console.log('📥 Response data:', data);

            if (data.success) {
                console.log('✅ Success! Setting results...');
                console.log('✅ Total cells detected:', data.stage1_detection?.total);
                setResults(data);
            } else {
                console.error('❌ Analysis failed:', data.error);
                setError(data.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('❌ Fetch error:', err);
            console.error('❌ Error stack:', err.stack);
            setError(`Failed to connect to backend: ${err.message}`);
        } finally {
            setLoading(false);
            console.log('🔵 handleAnalyze complete');
        }
    };

    // Save report to localStorage
    const saveReport = () => {
        if (!results) return;
        
        const reports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        const newReport = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            data: results
        };
        
        reports.unshift(newReport); // Add to beginning
        localStorage.setItem('hemalyzer_reports', JSON.stringify(reports));
        
        alert('Report saved successfully!');
        navigate('/reports');
    };

    // Render WBC classification results
    const renderWBCClassifications = () => {
        if (!results?.stage2_classification || results.stage2_classification.length === 0) {
            return <p className="text-gray-500">No WBCs detected for classification</p>;
        }

        return (
            <div className="space-y-3">
                <h3 className="font-semibold text-lg">WBC Classifications:</h3>
                {results.stage2_classification.map((wbc) => {
                    const isNormal = wbc.classification === 'Normal';
                    const bgColor = isNormal ? 'bg-green-100' : 'bg-red-100';
                    const textColor = isNormal ? 'text-green-800' : 'text-red-800';
                    const icon = isNormal ? '✓' : '⚠';

                    return (
                        <div key={wbc.wbc_id} className={`p-3 rounded-lg ${bgColor} ${textColor}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="font-semibold">
                                        {icon} WBC #{wbc.wbc_id}: {wbc.classification}
                                    </p>
                                    <p className="text-sm">
                                        Confidence: {(wbc.classification_confidence * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                            
                            {/* Show all probabilities */}
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer hover:underline">
                                    View all probabilities
                                </summary>
                                <div className="mt-2 space-y-1 ml-4">
                                    {Object.entries(wbc.probabilities).map(([cls, prob]) => (
                                        <div key={cls} className="flex justify-between">
                                            <span>{cls}:</span>
                                            <span className="font-mono">{(prob * 100).toFixed(2)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex grow flex-col items-start justify-start p-8">
                    <section className="grid grid-cols-2 gap-4 w-full grow">
                        {/* Upload Section */}
                        <div className="border border-gray-400 rounded-lg flex flex-col p-6">
                            <h2 className="text-2xl font-semibold mb-4 text-center">
                                Upload Blood Smear Image
                            </h2>
                            
                            {/* Image Preview */}
                            {previewUrl && (
                                <div className="mb-4 border-2 border-gray-300 rounded-lg overflow-hidden">
                                    <img 
                                        src={previewUrl} 
                                        alt="Preview" 
                                        className="w-full h-64 object-contain bg-gray-100"
                                    />
                                </div>
                            )}

                            {/* File Input */}
                            <label htmlFor="pbs-upload" className="mb-4">
                                <input 
                                    className="block w-full text-sm text-gray-900 border border-gray-300 
                                    rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2"
                                    id="pbs-upload" 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={loading}
                                />
                            </label>

                            {/* Analyze Button */}
                            <button 
                                onClick={handleAnalyze}
                                disabled={!selectedFile || loading}
                                className={`text-white bg-[#cb2a49] backdrop-blur-sm border border-white/20
                                hover:bg-white/20 hover:border-white/30 transition-all duration-300 
                                focus:ring-4 focus:outline-none focus:ring-white/30 shadow-md hover:shadow-xl 
                                font-semibold rounded-lg text-base px-6 py-3 cursor-pointer
                                ${(!selectedFile || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing...
                                    </span>
                                ) : (
                                    'Analyze Blood Cells'
                                )}
                            </button>

                            {/* Error Display */}
                            {error && (
                                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                                    <p className="font-semibold">Error:</p>
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}

                            {/* Disease Interpretation - Below Analyze Button */}
                            {results?.disease_interpretation && (
                                <DiseaseInterpretation 
                                    diseaseInterpretation={results.disease_interpretation}
                                    clinicalThresholds={results.clinical_thresholds}
                                />
                            )}
                        </div>

                        {/* Results Section */}
                        <div className="border border-gray-400 rounded-lg p-6 overflow-y-auto">
                            <h2 className="text-2xl font-semibold mb-4">Analysis Results</h2>
                            
                            {!results && !loading && (
                                <p className="text-gray-500 text-center mt-8">
                                    Upload an image and click "Analyze" to see results
                                </p>
                            )}

                            {results && (
                                <div className="space-y-6">
                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={saveReport}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                                        >
                                            💾 Save Report
                                        </button>
                                        <button
                                            onClick={() => setShowMetrics(!showMetrics)}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                                        >
                                            {showMetrics ? '📊 Hide Metrics' : '📊 Detailed Metrics'}
                                        </button>
                                    </div>
                                    
                                    {/* View Cell Classifications Button */}
                                    {results.cropped_cells && results.cropped_cells.length > 0 && (
                                        <button
                                            onClick={() => navigate('/classifications', {
                                                state: {
                                                    croppedCells: results.cropped_cells,
                                                    wbcClassifications: results.stage2_classification,
                                                    summary: results.summary,
                                                    results: results,
                                                    previewUrl: previewUrl
                                                }
                                            })}
                                            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center justify-center gap-2"
                                        >
                                            🔬 View Cell Classifications ({results.cropped_cells.length} cells)
                                        </button>
                                    )}
                                    
                                    {/* Classification Summary Alert */}
                                    {results.summary && (results.summary.abnormal_wbc_count > 0 || results.summary.sickle_cell_count > 0) && (
                                        <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
                                            <p className="font-bold text-red-800 flex items-center gap-2">
                                                ⚠️ Abnormal Cells Detected
                                            </p>
                                            <div className="mt-2 text-sm text-red-700 space-y-1">
                                                {results.summary.abnormal_wbc_count > 0 && (
                                                    <p>• {results.summary.abnormal_wbc_count} abnormal WBC(s) found</p>
                                                )}
                                                {results.summary.sickle_cell_count > 0 && (
                                                    <p>• {results.summary.sickle_cell_count} Sickle Cell(s) detected</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => navigate('/classifications', {
                                                    state: {
                                                        croppedCells: results.cropped_cells,
                                                        wbcClassifications: results.stage2_classification,
                                                        summary: results.summary,
                                                        results: results,
                                                        previewUrl: previewUrl
                                                    }
                                                })}
                                                className="mt-3 text-sm text-red-800 underline hover:text-red-900"
                                            >
                                                View detailed classifications →
                                            </button>
                                        </div>
                                    )}

                                    {/* Annotated Image */}
                                    {results.annotated_image && (
                                        <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                                            <img 
                                                src={`data:image/jpeg;base64,${results.annotated_image}`}
                                                alt="Annotated" 
                                                className="w-full"
                                            />
                                        </div>
                                    )}

                                    {/* Detection Summary */}
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <h3 className="font-semibold text-lg mb-2">Cell Detection Summary:</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>Total Cells: <strong>{results.stage1_detection?.total || 0}</strong></div>
                                            <div>RBC: <strong>{results.stage1_detection?.counts?.RBC || 0}</strong></div>
                                            <div>WBC: <strong>{results.stage1_detection?.counts?.WBC || 0}</strong></div>
                                            <div>Platelets: <strong>{results.stage1_detection?.counts?.Platelets || 0}</strong></div>
                                        </div>
                                    </div>

                                    {/* Detections List */}
                                    {results.stage1_detection?.cells && results.stage1_detection.cells.length > 0 && (
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-2">Detected Cells:</h3>
                                            <div className="max-h-48 overflow-y-auto space-y-2">
                                                {results.stage1_detection.cells.slice(0, 20).map((cell, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm p-2 bg-white rounded">
                                                        <span>#{idx + 1} - {cell.class}</span>
                                                        <span className="text-gray-600">{(cell.confidence * 100).toFixed(1)}%</span>
                                                    </div>
                                                ))}
                                                {results.stage1_detection.cells.length > 20 && (
                                                    <p className="text-gray-500 text-sm text-center">
                                                        ... and {results.stage1_detection.cells.length - 20} more
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Detailed Metrics Panel */}
                                    {showMetrics && (
                                        <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-blue-200">
                                            <h3 className="font-bold text-xl mb-4 text-blue-800">📊 Detailed Analysis Metrics</h3>
                                            
                                            {/* Cell Distribution */}
                                            <div className="bg-white p-4 rounded-lg mb-4">
                                                <h4 className="font-semibold mb-3">Cell Distribution Analysis</h4>
                                                <div className="space-y-2">
                                                    <div className="flex items-center">
                                                        <div className="w-32 text-sm">RBC:</div>
                                                        <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                                                            <div 
                                                                className="bg-red-500 h-full" 
                                                                style={{width: `${(results.stage1_detection?.counts?.RBC / results.stage1_detection?.total * 100) || 0}%`}}
                                                            ></div>
                                                        </div>
                                                        <div className="w-20 text-right text-sm font-mono">
                                                            {((results.stage1_detection?.counts?.RBC / results.stage1_detection?.total * 100) || 0).toFixed(1)}%
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-32 text-sm">WBC:</div>
                                                        <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                                                            <div 
                                                                className="bg-green-500 h-full" 
                                                                style={{width: `${(results.stage1_detection?.counts?.WBC / results.stage1_detection?.total * 100) || 0}%`}}
                                                            ></div>
                                                        </div>
                                                        <div className="w-20 text-right text-sm font-mono">
                                                            {((results.stage1_detection?.counts?.WBC / results.stage1_detection?.total * 100) || 0).toFixed(1)}%
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-32 text-sm">Platelets:</div>
                                                        <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                                                            <div 
                                                                className="bg-yellow-500 h-full" 
                                                                style={{width: `${(results.stage1_detection?.counts?.Platelets / results.stage1_detection?.total * 100) || 0}%`}}
                                                            ></div>
                                                        </div>
                                                        <div className="w-20 text-right text-sm font-mono">
                                                            {((results.stage1_detection?.counts?.Platelets / results.stage1_detection?.total * 100) || 0).toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Model Information */}
                                            <div className="bg-white p-4 rounded-lg mb-4">
                                                <h4 className="font-semibold mb-3">Model Configuration</h4>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="text-gray-600">Confidence Threshold:</span>
                                                        <p className="font-mono font-semibold">20% (0.2)</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600">Overlap Threshold:</span>
                                                        <p className="font-mono font-semibold">20% (0.2)</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detection Statistics */}
                                            <div className="bg-white p-4 rounded-lg">
                                                <h4 className="font-semibold mb-3">Detection Statistics</h4>
                                                <div className="grid grid-cols-3 gap-4 text-center">
                                                    <div className="bg-blue-50 p-3 rounded">
                                                        <p className="text-2xl font-bold text-blue-600">{results.stage1_detection?.total || 0}</p>
                                                        <p className="text-xs text-gray-600">Total Cells</p>
                                                    </div>
                                                    <div className="bg-green-50 p-3 rounded">
                                                        <p className="text-2xl font-bold text-green-600">
                                                            {results.stage1_detection?.cells ? 
                                                                (results.stage1_detection.cells.reduce((sum, c) => sum + c.confidence, 0) / results.stage1_detection.cells.length * 100).toFixed(1) 
                                                                : 0}%
                                                        </p>
                                                        <p className="text-xs text-gray-600">Avg Confidence</p>
                                                    </div>
                                                    <div className="bg-purple-50 p-3 rounded">
                                                        <p className="text-2xl font-bold text-purple-600">
                                                            {new Date().toLocaleTimeString()}
                                                        </p>
                                                        <p className="text-xs text-gray-600">Analysis Time</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Clinical Thresholds & Interpretation */}
                                    {results?.disease_interpretation && (
                                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200">
                                            <h3 className="font-bold text-xl mb-4 text-green-800">🩺 Clinical Thresholds & Interpretation</h3>
                                            <ThresholdResults 
                                                diseaseInterpretation={results.disease_interpretation}
                                                clinicalThresholds={results.clinical_thresholds}
                                            />
                                        </div>
                                    )}

                                    {/* Clinical Note */}
                                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
                                        <p className="font-semibold">⚠️ Clinical Note:</p>
                                        <p className="text-xs mt-1">
                                            This is a research tool for educational purposes. 
                                            Results should be validated by trained hematologists and 
                                            confirmed with additional diagnostic tests.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </main>
                <Footer />
            </div>
        </>
    )
}
export default Homepage;