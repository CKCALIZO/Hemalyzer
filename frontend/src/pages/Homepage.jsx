import { useState } from "react";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";

const API_URL = 'http://localhost:5000';

const Homepage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

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
        if (!selectedFile) {
            setError('Please select an image first');
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('conf_threshold', '0.25');
            formData.append('iou_threshold', '0.45');

            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                setResults(data);
            } else {
                setError(data.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('Error:', err);
            setError(`Failed to connect to backend: ${err.message}`);
        } finally {
            setLoading(false);
        }
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
                                            <div>Total Cells: <strong>{results.summary.total_cells}</strong></div>
                                            <div>RBC: <strong>{results.summary.cell_counts.RBC}</strong></div>
                                            <div>WBC: <strong>{results.summary.cell_counts.WBC}</strong></div>
                                            <div>Platelets: <strong>{results.summary.cell_counts.Platelets}</strong></div>
                                        </div>
                                    </div>

                                    {/* WBC Classifications */}
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        {renderWBCClassifications()}
                                    </div>

                                    {/* Leukemia Summary */}
                                    {results.summary.wbc_classifications && 
                                     Object.keys(results.summary.wbc_classifications).length > 0 && (
                                        <div className="bg-purple-50 p-4 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-2">Leukemia Analysis:</h3>
                                            <div className="space-y-1 text-sm">
                                                {Object.entries(results.summary.wbc_classifications).map(([cls, count]) => (
                                                    <div key={cls} className="flex justify-between">
                                                        <span>{cls}:</span>
                                                        <strong>{count}</strong>
                                                    </div>
                                                ))}
                                            </div>
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