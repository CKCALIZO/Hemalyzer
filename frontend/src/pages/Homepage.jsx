import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";
import { DiseaseInterpretation } from "../components/DiseaseInterpretation.jsx";
import { FinalResults } from "../components/FinalResults.jsx";
import { ProcessedImagesThumbnails } from "../components/ProcessedImagesThumbnails.jsx";

const API_URL = 'http://localhost:5000';

// Target image count for reliable diagnosis (10 images = 5 recommended fields x 2)
const TARGET_IMAGE_COUNT = 10;

// WBC Normal Differential Ranges (for final calculation)
const WBC_NORMAL_RANGES = {
    'Neutrophil': { min: 50, max: 70 },
    'Lymphocyte': { min: 18, max: 42 },
    'Monocyte': { min: 2, max: 11 },
    'Eosinophil': { min: 1, max: 3 },
    'Basophil': { min: 0, max: 2 }
};

const Homepage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // File handling
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Multi-image session state
    const [processedImages, setProcessedImages] = useState([]);
    const [aggregatedCounts, setAggregatedCounts] = useState({
        wbc: 0,
        rbc: 0,
        platelets: 0
    });
    const [aggregatedClassifications, setAggregatedClassifications] = useState([]);
    const [aggregatedRBCClassifications, setAggregatedRBCClassifications] = useState([]);
    const [currentResults, setCurrentResults] = useState(null);
    const [showCurrentResults, setShowCurrentResults] = useState(true);
    
    // Threshold tracking
    const [thresholdMet, setThresholdMet] = useState(false);
    const [finalResults, setFinalResults] = useState(null);

    // Restore state when navigating back from classifications
    useEffect(() => {
        if (location.state?.results) {
            setCurrentResults(location.state.results);
            setPreviewUrl(location.state.previewUrl);
        }
        // Restore full session state if available
        if (location.state?.sessionState) {
            const session = location.state.sessionState;
            if (session.processedImages) setProcessedImages(session.processedImages);
            if (session.aggregatedCounts) setAggregatedCounts(session.aggregatedCounts);
            if (session.aggregatedClassifications) setAggregatedClassifications(session.aggregatedClassifications);
            if (session.aggregatedRBCClassifications) setAggregatedRBCClassifications(session.aggregatedRBCClassifications);
            if (session.thresholdMet !== undefined) setThresholdMet(session.thresholdMet);
            if (session.finalResults) setFinalResults(session.finalResults);
        }
    }, [location.state]);

    // Handle file selection
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setCurrentResults(null);
            setError(null);
            setShowCurrentResults(true);
        }
    };

    // Calculate aggregated results when threshold is met
    const calculateFinalResults = useCallback((allClassifications, allProcessedImages, counts, allRBCClassifications = []) => {
        // Count WBC types from ConvNeXt classifications
        const wbcTypeCounts = {};
        
        // Normal WBC types (for differential)
        const normalWBCTypes = ['Neutrophil', 'Lymphocyte', 'Monocyte', 'Eosinophil', 'Basophil'];
        
        // Disease-indicating types from ConvNeXt
        // AML/ALL indicators: Acute Myeloid Leukemia, Acute Lymphoblastic Leukemia, Myeloblast
        // CML indicators: Granulocytes (Basophil, Eosinophil, Neutrophil) + Chronic Myeloid Leukemia
        // CLL indicators: Lymphocyte + Chronic Lymphocytic Leukemia
        
        allClassifications.forEach(cls => {
            const type = cls.classification;
            wbcTypeCounts[type] = (wbcTypeCounts[type] || 0) + 1;
        });

        // Calculate differential percentages
        const totalWBC = counts.wbc;
        const wbcDifferential = {};
        
        normalWBCTypes.forEach(type => {
            const count = wbcTypeCounts[type] || 0;
            const percentage = totalWBC > 0 ? (count / totalWBC) * 100 : 0;
            const normalRange = WBC_NORMAL_RANGES[type];
            let status = 'normal';
            
            if (normalRange) {
                if (percentage > normalRange.max) status = 'high';
                else if (percentage < normalRange.min) status = 'low';
            }
            
            wbcDifferential[type] = {
                count,
                percentage,
                normalRange: normalRange ? `${normalRange.min}-${normalRange.max}%` : '-',
                status
            };
        });

        // Calculate disease percentages based on About page thresholds
        
        // === AML/ALL ANALYSIS (Blast Cells) ===
        // Blast cells = Acute Myeloid Leukemia + Acute Lymphoblastic Leukemia + Myeloblast
        const amlCount = wbcTypeCounts['Acute Myeloid Leukemia'] || 0;
        const allCount = wbcTypeCounts['Acute Lymphoblastic Leukemia'] || 0;
        const myeloblastCount = wbcTypeCounts['Myeloblast'] || 0;
        const blastCount = amlCount + allCount + myeloblastCount;
        const blastPercentage = totalWBC > 0 ? (blastCount / totalWBC) * 100 : 0;
        
        // === CML ANALYSIS (Granulocytes) ===
        // Granulocytes = Basophil + Eosinophil + Neutrophil + Myeloblast + Chronic Myeloid Leukemia
        const cmlDirectCount = wbcTypeCounts['Chronic Myeloid Leukemia'] || 0;
        const granulocyteCount = (wbcTypeCounts['Neutrophil'] || 0) + 
                                (wbcTypeCounts['Eosinophil'] || 0) + 
                                (wbcTypeCounts['Basophil'] || 0) +
                                myeloblastCount +
                                cmlDirectCount;
        const granulocytePercentage = totalWBC > 0 ? (granulocyteCount / totalWBC) * 100 : 0;
        
        // === CLL ANALYSIS (Lymphocytes) ===
        // Lymphocytes = Lymphocyte + Chronic Lymphocytic Leukemia
        const cllDirectCount = wbcTypeCounts['Chronic Lymphocytic Leukemia'] || 0;
        const lymphocyteCount = (wbcTypeCounts['Lymphocyte'] || 0) + cllDirectCount;
        const lymphocytePercentage = totalWBC > 0 ? (lymphocyteCount / totalWBC) * 100 : 0;

        // Calculate disease findings based on About page thresholds
        const diseaseFindings = [];
        
        // AML/ALL Analysis (based on blast percentage thresholds from About page)
        // < 5% = Normal, 6-10% = Slightly Increased, 11-19% = Suspicious, >= 20% = Acute Leukemia
        if (blastCount > 0) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';
            
            if (blastPercentage >= 20) {
                // Determine if it's more likely AML or ALL based on cell types
                if (amlCount + myeloblastCount > allCount) {
                    interpretation = 'Diagnostic level for Acute Myeloid Leukemia (AML) - Higher myeloblast percentage';
                    condition = 'Acute Myeloid Leukemia (AML)';
                } else if (allCount > amlCount + myeloblastCount) {
                    interpretation = 'Diagnostic level for Acute Lymphoblastic Leukemia (ALL) - Higher lymphoblast percentage';
                    condition = 'Acute Lymphoblastic Leukemia (ALL)';
                } else {
                    interpretation = 'Diagnostic level for Acute Leukemia (>= 20% blasts) - Mixed blast population';
                    condition = 'Acute Leukemia (AML/ALL)';
                }
                severity = 'HIGH';
            } else if (blastPercentage >= 11) {
                interpretation = 'Suspicious / Pre-leukemic - suspicious for evolving leukemia';
                condition = 'Suspicious for evolving leukemia';
                severity = 'MODERATE';
            } else if (blastPercentage >= 6) {
                interpretation = 'Slightly Increased - possibly reactive, may be normal/reactive condition';
                condition = 'Possibly reactive condition';
                severity = 'LOW';
            } else {
                interpretation = 'Normal Blood - with some blast cells (< 5%)';
                condition = 'Normal with blast cells';
                severity = 'INFO';
            }
            
            diseaseFindings.push({
                type: 'Acute Leukemia (AML/ALL)',
                percentage: blastPercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    amlCount,
                    allCount,
                    myeloblastCount,
                    total: blastCount
                }
            });
        }

        // CML Analysis (based on granulocyte percentage thresholds from About page)
        // < 60% = Normal, 60-75% = Reactive, 76-89% = Early CML, 90-95% = Chronic Phase, > 95% = Accelerated
        if (granulocytePercentage >= 60) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';
            
            if (granulocytePercentage > 95) {
                interpretation = 'Accelerated Phase CML - extreme granulocytic proliferation with increasing blast count';
                condition = 'Accelerated Phase CML';
                severity = 'HIGH';
            } else if (granulocytePercentage >= 90) {
                interpretation = 'Typical Chronic Phase CML - granulocytes dominate differential; significant left shift';
                condition = 'Typical Chronic Phase CML';
                severity = 'MODERATE';
            } else if (granulocytePercentage >= 76) {
                interpretation = 'Suspicious for Early Chronic Myeloid Leukemia (CML - Chronic Phase) - marked granulocytic proliferation';
                condition = 'Suspicious for Early CML';
                severity = 'MODERATE';
            } else {
                interpretation = 'Reactive / Secondary Leukocytosis - mild granulocytic predominance; may reflect infection or stress';
                condition = 'Reactive Leukocytosis';
                severity = 'LOW';
            }
            
            diseaseFindings.push({
                type: 'CML Analysis',
                percentage: granulocytePercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    neutrophil: wbcTypeCounts['Neutrophil'] || 0,
                    eosinophil: wbcTypeCounts['Eosinophil'] || 0,
                    basophil: wbcTypeCounts['Basophil'] || 0,
                    myeloblast: myeloblastCount,
                    cmlDirect: cmlDirectCount,
                    total: granulocyteCount
                }
            });
        }

        // CLL Analysis (based on lymphocyte percentage thresholds from About page)
        // < 20% = Normal, 20-40% = Reactive, 41-60% = Early CLL, 61-80% = Typical CLL, > 80% = Advanced CLL
        if (lymphocytePercentage >= 40) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';
            
            if (lymphocytePercentage > 80) {
                interpretation = 'Advanced / Progressive CLL - lymphocytes dominate smear completely';
                condition = 'Advanced/Progressive CLL';
                severity = 'HIGH';
            } else if (lymphocytePercentage >= 61) {
                interpretation = 'Typical Chronic Lymphocytic Leukemia (CLL) - significant lymphocyte predominance';
                condition = 'Typical CLL';
                severity = 'MODERATE';
            } else if (lymphocytePercentage >= 41) {
                interpretation = 'Suspicious for Early / Smoldering CLL - elevated lymphocyte percentage';
                condition = 'Suspicious for Early CLL';
                severity = 'LOW';
            } else {
                interpretation = 'Reactive / Secondary Lymphocytosis - may occur with viral infections';
                condition = 'Reactive Lymphocytosis';
                severity = 'LOW';
            }
            
            diseaseFindings.push({
                type: 'CLL Analysis',
                percentage: lymphocytePercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    lymphocyte: wbcTypeCounts['Lymphocyte'] || 0,
                    cllDirect: cllDirectCount,
                    total: lymphocyteCount
                }
            });
        }

        // Sickle Cell Analysis
        let sickleCount = 0;
        allProcessedImages.forEach(img => {
            if (img.sickleCount) sickleCount += img.sickleCount;
        });
        const sicklePercentage = counts.rbc > 0 ? (sickleCount / counts.rbc) * 100 : 0;
        
        let sickleInterpretation = 'Normal blood, no sickling observed';
        if (sicklePercentage >= 1.6) {
            sickleInterpretation = 'Severe Sickle Cell Anemia (advanced HbSS)';
        } else if (sicklePercentage >= 1.1) {
            sickleInterpretation = 'Sickle Cell Disease - symptomatic, chronic anemia';
        } else if (sicklePercentage >= 0.7) {
            sickleInterpretation = 'Sickle Cell Trait (HbAS) - usually mild or asymptomatic';
        } else if (sicklePercentage >= 0.4) {
            sickleInterpretation = 'Minimal sickling - may be normal or carrier';
        }

        // Determine overall patient status
        let patientStatus = 'Normal';
        const hasCritical = diseaseFindings.some(f => f.severity === 'HIGH');
        const hasAbnormal = diseaseFindings.some(f => f.severity === 'MODERATE' || f.severity === 'LOW');
        
        if (hasCritical || sicklePercentage >= 1.1) {
            patientStatus = 'Critical';
        } else if (hasAbnormal || sicklePercentage >= 0.4) {
            patientStatus = 'Abnormal';
        }

        return {
            thresholdMet: true,
            totalWBC: counts.wbc,
            totalRBC: counts.rbc,
            totalPlatelets: counts.platelets,
            wbcClassifications: allClassifications,
            rbcClassifications: allRBCClassifications, // Add RBC classifications
            wbcDifferential,
            diseaseFindings,
            classificationCounts: wbcTypeCounts, // All ConvNeXt classification counts
            sickleCell: {
                count: sickleCount,
                totalRBC: counts.rbc,
                percentage: sicklePercentage,
                interpretation: sickleInterpretation
            },
            patientStatus
        };
    }, []);

    // Handle upload and analysis
    const handleAnalyze = async () => {
        if (!selectedFile) {
            setError('Please select an image first');
            return;
        }

        // Don't allow more uploads if threshold already met
        if (thresholdMet) {
            setError('Analysis complete. Click "New Analysis" to start over.');
            return;
        }

        setLoading(true);
        setError(null);
        setShowCurrentResults(true);

        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('conf_threshold', '0.2');
            formData.append('iou_threshold', '0.2');
            
            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                // Extract counts from this image
                const wbcCount = data.stage1_detection?.counts?.WBC || 0;
                const rbcCount = data.stage1_detection?.counts?.RBC || 0;
                const plateletCount = data.stage1_detection?.counts?.Platelets || 0;
                
                // Extract sickle cell count if available
                let sickleCount = 0;
                if (data.disease_interpretation?.sickle_cell_analysis) {
                    sickleCount = data.disease_interpretation.sickle_cell_analysis.sickle_cell_count || 0;
                }

                // Create processed image record
                const processedImage = {
                    id: Date.now(),
                    fileName: selectedFile.name,
                    preview: previewUrl,
                    annotated: data.annotated_image,
                    wbcCount,
                    rbcCount,
                    plateletCount,
                    sickleCount,
                    classifications: data.stage2_classification || [],
                    results: data
                };

                // Update aggregated counts
                const newCounts = {
                    wbc: aggregatedCounts.wbc + wbcCount,
                    rbc: aggregatedCounts.rbc + rbcCount,
                    platelets: aggregatedCounts.platelets + plateletCount
                };

                // Update aggregated classifications (include cropped images from stage2_classification)
                // The stage2_classification array should include wbc_id, classification, confidence, and cropped_image
                const classificationsWithImages = (data.stage2_classification || []).map((cls, idx) => {
                    // If the classification doesn't have a cropped_image, try to get it from cropped_cells
                    if (!cls.cropped_image && data.cropped_cells) {
                        const matchingCell = data.cropped_cells.find(cell => 
                            cell.cell_type === 'WBC' && cell.wbc_id === cls.wbc_id
                        );
                        if (matchingCell) {
                            return { ...cls, cropped_image: matchingCell.cropped_image };
                        }
                    }
                    return cls;
                });
                
                const newClassifications = [
                    ...aggregatedClassifications,
                    ...classificationsWithImages
                ];

                // Extract RBC classifications from cropped_cells (for sickle cell detection)
                const rbcCells = (data.cropped_cells || []).filter(cell => cell.cell_type === 'RBC');
                const newRBCClassifications = [
                    ...aggregatedRBCClassifications,
                    ...rbcCells
                ];

                // Update state
                const newProcessedImages = [...processedImages, processedImage];
                setProcessedImages(newProcessedImages);
                setAggregatedCounts(newCounts);
                setAggregatedClassifications(newClassifications);
                setAggregatedRBCClassifications(newRBCClassifications);
                setCurrentResults(data);

                // Check if threshold is met (10 images analyzed)
                if (newProcessedImages.length >= TARGET_IMAGE_COUNT) {
                    setThresholdMet(true);
                    const finalCalc = calculateFinalResults(newClassifications, newProcessedImages, newCounts, newRBCClassifications);
                    setFinalResults(finalCalc);
                }

                // Clear file selection for next upload
                setSelectedFile(null);
                setPreviewUrl(null);
                
                // Reset file input
                const fileInput = document.getElementById('pbs-upload');
                if (fileInput) fileInput.value = '';

            } else {
                setError(data.error || 'Analysis failed');
            }
        } catch (err) {
            setError(`Failed to connect to backend: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Reset analysis session
    const handleReset = () => {
        setProcessedImages([]);
        setAggregatedCounts({ wbc: 0, rbc: 0, platelets: 0 });
        setAggregatedClassifications([]);
        setAggregatedRBCClassifications([]);
        setCurrentResults(null);
        setThresholdMet(false);
        setFinalResults(null);
        setSelectedFile(null);
        setPreviewUrl(null);
        setError(null);
    };

    // Save report to localStorage
    const saveReport = () => {
        if (!finalResults) return;
        
        const reports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        const newReport = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            data: finalResults,
            imagesCount: processedImages.length
        };
        
        reports.unshift(newReport);
        localStorage.setItem('hemalyzer_reports', JSON.stringify(reports));
        
        alert('Report saved successfully!');
        navigate('/reports');
    };

    // Calculate progress based on image count
    const progress = Math.min(100, (processedImages.length / TARGET_IMAGE_COUNT) * 100);
    const remainingImages = Math.max(0, TARGET_IMAGE_COUNT - processedImages.length);

    // Legacy compatibility - unused but keeping structure
    const renderWBCClassifications = () => {
        return null;
    };

    return (
        <div className="flex flex-col min-h-screen bg-rose-50">
            <Header />
            <main className="flex-1 p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Page Title */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-rose-800">Blood Smear Analysis</h1>
                        <p className="text-rose-600 text-sm mt-1">
                            Upload 10 blood smear images for accurate differential count and disease assessment
                        </p>
                    </div>

                    {/* Processed Images Thumbnail Bar */}
                    {processedImages.length > 0 && (
                        <ProcessedImagesThumbnails
                            processedImages={processedImages}
                            currentImageCount={processedImages.length}
                            targetImageCount={TARGET_IMAGE_COUNT}
                        />
                    )}

                    {/* Final Results (shown when 100 WBC threshold is met) */}
                    {thresholdMet && finalResults && (
                        <div className="mb-6">
                            <FinalResults
                                aggregatedResults={finalResults}
                                processedImages={processedImages}
                                onReset={handleReset}
                            />
                        </div>
                    )}

                    {/* Main Content Grid */}
                    {!thresholdMet && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Upload Section */}
                            <div className="bg-white rounded-lg border border-rose-200 shadow-sm">
                                <div className="px-6 py-4 border-b border-rose-200 bg-rose-50">
                                    <h2 className="text-lg font-semibold text-rose-800">
                                        Upload Blood Smear Image
                                    </h2>
                                    <p className="text-sm text-rose-600 mt-1">
                                        {processedImages.length} / {TARGET_IMAGE_COUNT} images analyzed
                                    </p>
                                </div>
                                
                                <div className="p-6">
                                    {/* Progress Indicator */}
                                    <div className="mb-6 bg-rose-50 rounded-lg p-4 border border-rose-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-rose-700">Analysis Progress</span>
                                            <span className="text-sm text-rose-600">
                                                {processedImages.length} / {TARGET_IMAGE_COUNT} Images
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-rose-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-rose-500 transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        {remainingImages > 0 ? (
                                            <p className="text-xs text-rose-600 mt-2">
                                                Need {remainingImages} more image{remainingImages > 1 ? 's' : ''} for reliable differential
                                            </p>
                                        ) : (
                                            <p className="text-xs text-emerald-600 mt-2 font-medium">
                                                Threshold met! Processing final results...
                                            </p>
                                        )}
                                    </div>

                                    {/* Image Preview */}
                                    {previewUrl && (
                                        <div className="mb-4 rounded-lg overflow-hidden border border-red-200">
                                            <img 
                                                src={previewUrl} 
                                                alt="Preview" 
                                                className="w-full h-64 object-contain bg-rose-50"
                                            />
                                        </div>
                                    )}

                                    {/* File Input */}
                                    <div className="mb-4">
                                        <input 
                                            className="block w-full text-sm text-rose-700 border border-rose-300 
                                            rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 
                                            focus:ring-rose-400 p-2"
                                            id="pbs-upload" 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            disabled={loading || thresholdMet}
                                        />
                                    </div>

                                    {/* Analyze Button */}
                                    <button 
                                        onClick={handleAnalyze}
                                        disabled={!selectedFile || loading || thresholdMet}
                                        className={`w-full flex items-center justify-center gap-2 text-white 
                                        bg-rose-600 hover:bg-rose-500 transition-colors font-semibold 
                                        rounded-lg text-base px-6 py-3
                                        ${(!selectedFile || loading || thresholdMet) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                Analyze Image
                                            </>
                                        )}
                                    </button>

                                    {/* Error Display */}
                                    {error && (
                                        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                                            <p className="font-semibold text-sm">Error</p>
                                            <p className="text-sm">{error}</p>
                                        </div>
                                    )}

                                    {/* Aggregated Stats */}
                                    {processedImages.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-rose-200">
                                            <h3 className="text-sm font-semibold text-rose-700 mb-3">
                                                Session Totals ({processedImages.length} images)
                                            </h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                                                    <p className="text-xl font-bold text-rose-700">{aggregatedCounts.wbc}</p>
                                                    <p className="text-xs text-rose-600">WBC</p>
                                                </div>
                                                <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                                                    <p className="text-xl font-bold text-rose-600">{aggregatedCounts.rbc}</p>
                                                    <p className="text-xs text-rose-600">RBC</p>
                                                </div>
                                                <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                                                    <p className="text-xl font-bold text-rose-500">{aggregatedCounts.platelets}</p>
                                                    <p className="text-xs text-rose-600">Platelets</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reset Button */}
                                    {processedImages.length > 0 && (
                                        <button
                                            onClick={handleReset}
                                            className="w-full mt-4 px-4 py-2 bg-white border border-rose-300 text-rose-600 
                                            rounded-lg hover:bg-rose-50 transition-colors text-sm font-medium"
                                        >
                                            Reset Analysis Session
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Results Section */}
                            <div className="bg-white rounded-lg border border-rose-200 shadow-sm">
                                <div className="px-6 py-4 border-b border-rose-200 bg-rose-50 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-rose-800">
                                            Current Image Results
                                        </h2>
                                        <p className="text-sm text-rose-600 mt-1">
                                            Analysis of the most recently uploaded image
                                        </p>
                                    </div>
                                    {currentResults && (
                                        <button
                                            onClick={() => setShowCurrentResults(!showCurrentResults)}
                                            className="text-sm text-rose-600 hover:text-rose-800"
                                        >
                                            {showCurrentResults ? 'Hide' : 'Show'}
                                        </button>
                                    )}
                                </div>
                                
                                <div className="p-6 max-h-[70vh] overflow-y-auto">
                                    {!currentResults && !loading && (
                                        <div className="text-center py-12">
                                            <svg className="w-16 h-16 mx-auto text-rose-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-rose-400">
                                                Upload an image and click "Analyze" to see results
                                            </p>
                                        </div>
                                    )}

                                    {currentResults && showCurrentResults && (
                                        <div className="space-y-4">
                                            {/* View Cell Classifications Button */}
                                            {currentResults.cropped_cells && currentResults.cropped_cells.length > 0 && (
                                                <button
                                                    onClick={() => navigate('/classifications', {
                                                        state: {
                                                            croppedCells: currentResults.cropped_cells,
                                                            wbcClassifications: currentResults.stage2_classification,
                                                            summary: currentResults.summary,
                                                            results: currentResults,
                                                            previewUrl: previewUrl,
                                                            // Pass session state for restoration
                                                            sessionState: {
                                                                processedImages,
                                                                aggregatedCounts,
                                                                aggregatedClassifications,
                                                                aggregatedRBCClassifications,
                                                                thresholdMet,
                                                                finalResults
                                                            }
                                                        }
                                                    })}
                                                    className="w-full px-4 py-3 bg-rose-50 text-rose-600 rounded-lg 
                                                    hover:bg-rose-100 font-medium flex items-center justify-center gap-2 
                                                    border border-rose-200 transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    View Cell Classifications ({currentResults.cropped_cells.length} cells)
                                                </button>
                                            )}

                                            {/* Annotated Image */}
                                            {currentResults.annotated_image && (
                                                <div className="rounded-lg overflow-hidden border border-slate-200">
                                                    <img 
                                                        src={`data:image/jpeg;base64,${currentResults.annotated_image}`}
                                                        alt="Annotated" 
                                                        className="w-full"
                                                    />
                                                </div>
                                            )}

                                            {/* Detection Summary */}
                                            <div className="bg-slate-50 p-4 rounded-lg">
                                                <h3 className="font-semibold text-slate-700 mb-3">Detection Summary</h3>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Total Cells:</span>
                                                        <span className="font-semibold">{currentResults.stage1_detection?.total || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">RBC:</span>
                                                        <span className="font-semibold text-rose-600">{currentResults.stage1_detection?.counts?.RBC || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">WBC:</span>
                                                        <span className="font-semibold">{currentResults.stage1_detection?.counts?.WBC || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Platelets:</span>
                                                        <span className="font-semibold text-amber-600">{currentResults.stage1_detection?.counts?.Platelets || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Abnormal Cells Alert */}
                                            {currentResults.summary && (currentResults.summary.abnormal_wbc_count > 0 || currentResults.summary.sickle_cell_count > 0) && (
                                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                                    <p className="font-semibold text-amber-800 flex items-center gap-2">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        Abnormal Cells Detected
                                                    </p>
                                                    <div className="mt-2 text-sm text-amber-700 space-y-1">
                                                        {currentResults.summary.abnormal_wbc_count > 0 && (
                                                            <p>• {currentResults.summary.abnormal_wbc_count} abnormal WBC(s) found</p>
                                                        )}
                                                        {currentResults.summary.sickle_cell_count > 0 && (
                                                            <p>• {currentResults.summary.sickle_cell_count} Sickle Cell(s) detected</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Clinical Note */}
                                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm">
                                                <p className="font-semibold text-slate-700">Note:</p>
                                                <p className="text-xs mt-1 text-slate-600">
                                                    Continue uploading images until 10 images are analyzed for 
                                                    a reliable differential count and disease assessment.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default Homepage;