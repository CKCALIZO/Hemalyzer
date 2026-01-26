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
// Based on standard hematology reference values
const WBC_NORMAL_RANGES = {
    'Neutrophil': { min: 45, max: 65 },
    'Lymphocyte': { min: 20, max: 35 },
    'Monocyte': { min: 2, max: 6 },
    'Eosinophil': { min: 2, max: 4 },
    'Basophil': { min: 0, max: 1 }
};

// Cell count calculation constants
// RBC formula: (Average RBC per image ÷ 10) × 200,000
// - Calculate average: (Total RBC across all images) ÷ (Number of images)
// - Then: (Average ÷ 10) × 200,000 = Estimated RBC/μL
// WBC count: (Total WBC ÷ 10) × 2,000
const RBC_MULTIPLIER = 200000;
const WBC_MULTIPLIER = 2000;
const NUM_FIELDS = 10;

const Homepage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // File handling
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Progress tracking
    const [analysisProgress, setAnalysisProgress] = useState({
        stage: '',
        percentage: 0,
        message: ''
    });
    
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

    // Restore state when navigating back from classifications OR on page reload
    useEffect(() => {
        // First try to restore from location.state (navigation)
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
        // If no location state, try to restore from localStorage (page reload)
        else {
            try {
                const savedSession = localStorage.getItem('hemalyzer_current_session');
                if (savedSession) {
                    const session = JSON.parse(savedSession);
                    console.log('Restoring session from localStorage:', session);
                    if (session.processedImages) setProcessedImages(session.processedImages);
                    if (session.aggregatedCounts) setAggregatedCounts(session.aggregatedCounts);
                    if (session.aggregatedClassifications) setAggregatedClassifications(session.aggregatedClassifications);
                    if (session.aggregatedRBCClassifications) setAggregatedRBCClassifications(session.aggregatedRBCClassifications);
                    if (session.thresholdMet !== undefined) setThresholdMet(session.thresholdMet);
                    if (session.finalResults) setFinalResults(session.finalResults);
                    if (session.currentResults) setCurrentResults(session.currentResults);
                }
            } catch (error) {
                console.log('No valid session to restore:', error);
            }
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
        // NEW MODEL FORMAT: "CellType: Condition" (e.g., "Basophil: Normal", "Basophil: CML")
        const wbcTypeCounts = {};
        
        // 5 main WBC categories (for differential) - count regardless of condition
        const mainWBCCategories = ['Neutrophil', 'Lymphocyte', 'Monocyte', 'Eosinophil', 'Basophil'];
        
        // Initialize differential counts for 5 main categories
        const differentialCounts = {
            'Neutrophil': 0,
            'Lymphocyte': 0,
            'Monocyte': 0,
            'Eosinophil': 0,
            'Basophil': 0
        };
        
        // Disease counts
        let cmlCount = 0;
        let cllCount = 0;
        let allCount = 0;
        let amlCount = 0;
        
        // Track abnormal WBCs (for Abnormal WBCs button)
        const abnormalWBCs = [];
        
        allClassifications.forEach(cls => {
            const classification = cls.classification || '';
            wbcTypeCounts[classification] = (wbcTypeCounts[classification] || 0) + 1;
            
            // Extract cell type from new format "CellType: Condition"
            const cellTypePart = classification.split(':')[0]?.trim() || '';
            const conditionPart = classification.split(':')[1]?.trim()?.toLowerCase() || '';
            
            // Enhanced mapping for 20-class model to 5 main WBC categories
            const cellTypeLower = cellTypePart.toLowerCase();
            
            // Map detailed cell types to main categories
            if (cellTypeLower.includes('neutrophil') || cellTypeLower.includes('neutrophils')) {
                differentialCounts['Neutrophil']++;
            } else if (cellTypeLower.includes('lymphocyte') || cellTypeLower.includes('b_lymphoblast')) {
                differentialCounts['Lymphocyte']++;
            } else if (cellTypeLower.includes('monocyte')) {
                differentialCounts['Monocyte']++;
            } else if (cellTypeLower.includes('eosinophil') || cellTypeLower.includes('eosonophil')) {
                differentialCounts['Eosinophil']++;
            } else if (cellTypeLower.includes('basophil')) {
                differentialCounts['Basophil']++;
            } else if (cellTypeLower.includes('myeloblast') || cellTypeLower.includes('myelocyte') || 
                      cellTypeLower.includes('metamyelocyte') || cellTypeLower.includes('promyelocyte')) {
                // Immature granulocytes - count as Neutrophils
                differentialCounts['Neutrophil']++;
            } else if (cellTypeLower.includes('erythroblast')) {
                // Nucleated RBC - don't count in WBC differential
            }
            
            // Track abnormal WBCs (condition is not "normal")
            if (conditionPart && conditionPart !== 'normal') {
                abnormalWBCs.push(cls);
            }
            
            // Count disease markers
            if (conditionPart === 'cml') cmlCount++;
            if (conditionPart === 'cll') cllCount++;
            if (conditionPart === 'all') allCount++;
            if (conditionPart === 'aml') amlCount++;
        });
        
        // Calculate estimated cell counts using standard formulas
        // RBC formula: 
        // Step 1: Calculate average RBC per image (Total RBC ÷ Number of images)
        // Step 2: Divide average by 10, then multiply by 200,000
        // Formula: (Average RBC per image ÷ 10) × 200,000 = Estimated RBC/μL
        // WBC count: (Total WBC ÷ 10) × 2,000
        
        const totalImagesProcessed = allProcessedImages.length;
        
        // Step 1: Calculate average RBC count per image
        const averageRBCPerImage = totalImagesProcessed > 0 ? counts.rbc / totalImagesProcessed : 0;
        
        // Step 2: Divide average by 10, then multiply by 200,000
        const estimatedRBCCount = Math.round((averageRBCPerImage / 10) * RBC_MULTIPLIER);
        const estimatedWBCCount = Math.round((counts.wbc / NUM_FIELDS) * WBC_MULTIPLIER);

        // Calculate differential percentages based on 5 main WBC categories
        const totalWBC = counts.wbc;
        const wbcDifferential = {};
        
        // Calculate percentage for each of the 5 main WBC categories
        mainWBCCategories.forEach(category => {
            const count = differentialCounts[category];
            const percentage = totalWBC > 0 ? (count / totalWBC) * 100 : 0;
            const normalRange = WBC_NORMAL_RANGES[category];
            let status = 'normal';
            
            if (normalRange) {
                if (percentage > normalRange.max) status = 'high';
                else if (percentage < normalRange.min) status = 'low';
            }
            
            wbcDifferential[category] = {
                count,
                percentage,
                normalRange: normalRange ? `${normalRange.min}-${normalRange.max}%` : '-',
                status
            };
        });

        // Calculate disease percentages based on About page thresholds
        // Using disease counts extracted from "CellType: Condition" format
        
        // === AML/ALL ANALYSIS (Blast Cells) ===
        // Count cells with ": all" or ": aml" in their classification
        const blastCount = amlCount + allCount;
        const blastPercentage = totalWBC > 0 ? (blastCount / totalWBC) * 100 : 0;
        
        // === CML ANALYSIS ===
        // Count cells classified as CML (e.g., "Basophil: CML", "Neutrophils: CML")
        const cmlPercentage = totalWBC > 0 ? (cmlCount / totalWBC) * 100 : 0;
        
        // === CLL ANALYSIS ===
        // Count cells classified as CLL (e.g., "Lymphocyte: CLL")
        const cllPercentage = totalWBC > 0 ? (cllCount / totalWBC) * 100 : 0;

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
                if (amlCount > allCount) {
                    interpretation = 'Diagnostic level for Acute Myeloid Leukemia (AML)';
                    condition = 'Acute Myeloid Leukemia (AML)';
                } else if (allCount > amlCount) {
                    interpretation = 'Diagnostic level for Acute Lymphoblastic Leukemia (ALL)';
                    condition = 'Acute Lymphoblastic Leukemia (ALL)';
                } else {
                    interpretation = 'Diagnostic level for Acute Leukemia (>= 20% blasts)';
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
                    total: blastCount
                }
            });
        }

        // CML Analysis - based on CML-classified cells percentage
        // Only show if there are CML-classified cells
        if (cmlCount > 0) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';
            
            if (cmlPercentage > 50) {
                interpretation = 'Significant CML cell population detected';
                condition = 'Chronic Myeloid Leukemia (CML)';
                severity = 'HIGH';
            } else if (cmlPercentage >= 20) {
                interpretation = 'Moderate CML cell population - suggestive of CML';
                condition = 'Suspicious for CML';
                severity = 'MODERATE';
            } else if (cmlPercentage >= 5) {
                interpretation = 'Low CML cell percentage - monitor closely';
                condition = 'Low CML markers';
                severity = 'LOW';
            } else {
                interpretation = 'Minimal CML markers detected';
                condition = 'Minimal CML markers';
                severity = 'INFO';
            }
            
            diseaseFindings.push({
                type: 'CML Analysis',
                percentage: cmlPercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    cmlCells: cmlCount,
                    totalWBC: totalWBC
                }
            });
        }

        // CLL Analysis - based on CLL-classified cells percentage
        // Only show if there are CLL-classified cells
        if (cllCount > 0) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';
            
            if (cllPercentage > 50) {
                interpretation = 'Significant CLL cell population detected';
                condition = 'Chronic Lymphocytic Leukemia (CLL)';
                severity = 'HIGH';
            } else if (cllPercentage >= 20) {
                interpretation = 'Moderate CLL cell population - suggestive of CLL';
                condition = 'Suspicious for CLL';
                severity = 'MODERATE';
            } else if (cllPercentage >= 5) {
                interpretation = 'Low CLL cell percentage - monitor closely';
                condition = 'Low CLL markers';
                severity = 'LOW';
            } else {
                interpretation = 'Minimal CLL markers detected';
                condition = 'Minimal CLL markers';
                severity = 'INFO';
            }
            
            diseaseFindings.push({
                type: 'CLL Analysis',
                percentage: cllPercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    cllCells: cllCount,
                    totalWBC: totalWBC
                }
            });
        }

        // Sickle Cell Analysis - using updated thresholds from About page
        // < 3% = Normal, 3-10% = Mild (HbAS), 10-30% = Moderate, > 30% = Severe (HbSS)
        let sickleCount = 0;
        allProcessedImages.forEach(img => {
            if (img.sickleCount) sickleCount += img.sickleCount;
        });
        const sicklePercentage = counts.rbc > 0 ? (sickleCount / counts.rbc) * 100 : 0;
        
        let sickleInterpretation = 'Normal blood, no sickling observed';
        let sickleSeverity = 'NORMAL';
        if (sicklePercentage > 30) {
            sickleInterpretation = 'Severe Sickle Cell Anemia (HbSS) - significant sickling detected';
            sickleSeverity = 'SEVERE';
        } else if (sicklePercentage >= 10) {
            sickleInterpretation = 'Moderate Sickling - symptomatic, chronic anemia';
            sickleSeverity = 'MODERATE';
        } else if (sicklePercentage >= 3) {
            sickleInterpretation = 'Mild Sickling (HbAS) - sickle cell trait, usually asymptomatic';
            sickleSeverity = 'MILD';
        } else if (sicklePercentage > 0) {
            sickleInterpretation = 'Normal blood with minimal sickling (< 3%)';
            sickleSeverity = 'NORMAL';
        }

        // Determine overall patient status
        let patientStatus = 'Normal';
        const hasCritical = diseaseFindings.some(f => f.severity === 'HIGH');
        const hasAbnormal = diseaseFindings.some(f => f.severity === 'MODERATE' || f.severity === 'LOW');
        
        if (hasCritical || sicklePercentage > 30) {
            patientStatus = 'Critical';
        } else if (hasAbnormal || sicklePercentage >= 3) {
            patientStatus = 'Abnormal';
        }

        return {
            thresholdMet: true,
            totalWBC: counts.wbc,
            totalRBC: counts.rbc,
            totalPlatelets: counts.platelets,
            // Estimated counts using standard formulas
            // RBC: (Avg RBC / 10) x 200,000
            // WBC: (Total WBC / 10) x 2,000
            estimatedWBCCount,
            estimatedRBCCount,
            avgRBCPerField,
            wbcClassifications: allClassifications,
            rbcClassifications: allRBCClassifications, // Add RBC classifications
            abnormalWBCs, // WBCs with non-normal conditions (e.g., CML, ALL, AML, CLL)
            wbcDifferential,
            diseaseFindings,
            classificationCounts: wbcTypeCounts, // All ConvNeXt classification counts
            sickleCell: {
                count: sickleCount,
                totalRBC: counts.rbc,
                percentage: sicklePercentage,
                interpretation: sickleInterpretation,
                severity: sickleSeverity
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
        setAnalysisProgress({ stage: 'upload', percentage: 10, message: 'Uploading image...' });
        setShowCurrentResults(true);

        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('conf_threshold', '0.2');
            formData.append('iou_threshold', '0.2');
            
            setAnalysisProgress({ stage: 'detection', percentage: 30, message: 'Detecting cells with YOLOv8...' });
            
            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                body: formData,
            });
            
            setAnalysisProgress({ stage: 'classification', percentage: 60, message: 'Classifying cells with ConvNeXt...' });

            const data = await response.json();
            
            setAnalysisProgress({ stage: 'analysis', percentage: 85, message: 'Analyzing results...' });

            if (data.success) {
                // Extract counts from this image
                const wbcCount = data.stage1_detection?.counts?.WBC || 0;
                const rbcCount = data.stage1_detection?.counts?.RBC || 0;
                const plateletCount = data.stage1_detection?.counts?.Platelets || 0;
                
                // Extract sickle cell count from summary (not disease_interpretation)
                const sickleCount = data.summary?.sickle_cell_count || 0;

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

                // Update state with error handling
                try {
                    const newProcessedImages = [...processedImages, processedImage];
                    console.log('Setting processed images:', newProcessedImages.length);
                    setProcessedImages(newProcessedImages);
                    setAggregatedCounts(newCounts);
                    setAggregatedClassifications(newClassifications);
                    setAggregatedRBCClassifications(newRBCClassifications);
                    setCurrentResults(data);
                    console.log('State update complete, currentResults set');

                    // Check if threshold is met (10 images analyzed)
                    if (newProcessedImages.length >= TARGET_IMAGE_COUNT) {
                        setThresholdMet(true);
                        const finalCalc = calculateFinalResults(newClassifications, newProcessedImages, newCounts, newRBCClassifications);
                        setFinalResults(finalCalc);
                    }
                    
                    // Save session state to localStorage for persistence on reload
                    const sessionState = {
                        processedImages: newProcessedImages,
                        aggregatedCounts: newCounts,
                        aggregatedClassifications: newClassifications,
                        aggregatedRBCClassifications: newRBCClassifications,
                        thresholdMet: newProcessedImages.length >= TARGET_IMAGE_COUNT,
                        finalResults: newProcessedImages.length >= TARGET_IMAGE_COUNT ? 
                            calculateFinalResults(newClassifications, newProcessedImages, newCounts, newRBCClassifications) : null,
                        currentResults: data,
                        timestamp: Date.now()
                    };
                    localStorage.setItem('hemalyzer_current_session', JSON.stringify(sessionState));
                    console.log('Session saved to localStorage:', sessionState);
                } catch (stateError) {
                    console.error('Error updating state:', stateError);
                    setError(`State update error: ${stateError.message}`);
                }

                // Clear file selection for next upload BUT keep preview of last analyzed image
                setSelectedFile(null);
                // DON'T clear previewUrl - keep showing the last analyzed image
                // setPreviewUrl(null); // Removed - keep the image visible
                
                // Reset file input for next upload
                const fileInput = document.getElementById('pbs-upload');
                if (fileInput) fileInput.value = '';
                
                setAnalysisProgress({ stage: 'complete', percentage: 100, message: 'Analysis complete!' });
                setTimeout(() => {
                    setAnalysisProgress({ stage: '', percentage: 0, message: '' });
                }, 2000);

            } else {
                setError(data.error || 'Analysis failed');
                setAnalysisProgress({ stage: '', percentage: 0, message: '' });
            }
        } catch (err) {
            setError(`Failed to connect to backend: ${err.message}`);
            setAnalysisProgress({ stage: '', percentage: 0, message: '' });
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
        
        // Clear saved session from localStorage
        localStorage.removeItem('hemalyzer_current_session');
        console.log('Session cleared from localStorage');
    };

    // Save report to localStorage with complete analysis data
    const saveReport = () => {
        if (!finalResults) {
            alert('No final results to save. Please complete the analysis first.');
            return;
        }
        
        const reports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        const newReport = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            // Include complete analysis data
            data: finalResults,
            // Add session metadata
            sessionData: {
                processedImages: processedImages,
                aggregatedCounts: aggregatedCounts,
                aggregatedClassifications: aggregatedClassifications,
                aggregatedRBCClassifications: aggregatedRBCClassifications,
                thresholdMet: thresholdMet,
                totalImagesAnalyzed: processedImages.length,
                analysisComplete: thresholdMet
            },
            // Add summary for quick display
            summary: {
                totalCells: aggregatedCounts.wbc + aggregatedCounts.rbc + aggregatedCounts.platelets,
                wbcCount: aggregatedCounts.wbc,
                rbcCount: aggregatedCounts.rbc,
                plateletCount: aggregatedCounts.platelets,
                imagesAnalyzed: processedImages.length,
                // Include estimated counts
                estimatedWBCCount: finalResults?.estimatedWBCCount || 0,
                estimatedRBCCount: finalResults?.estimatedRBCCount || 0,
                // Include disease findings
                diseaseFindings: finalResults?.diseaseFindings || [],
                sickleCount: finalResults?.sickleCount || 0
            },
            imagesCount: processedImages.length
        };
        
        reports.unshift(newReport);
        // Keep only last 50 reports to prevent localStorage overflow
        if (reports.length > 50) {
            reports.splice(50);
        }
        localStorage.setItem('hemalyzer_reports', JSON.stringify(reports));
        
        alert(`Report saved successfully! \nImages analyzed: ${processedImages.length}\nTotal cells: ${newReport.summary.totalCells}`);
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
        <div className="flex flex-col min-h-screen bg-stone-50 font-sans selection:bg-rose-100 selection:text-rose-900">
            <Header />
            <main className="flex-grow p-4 lg:p-8 xl:p-12">
                <div className="max-w-[1600px] mx-auto">
                    {/* Diagnostic Engine Header */}
                    <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6 px-4">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-lg shadow-rose-200">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                System Operational
                            </div>
                            <h1 className="text-6xl font-black text-zinc-950 tracking-tighter leading-none mb-2 uppercase">
                                Diagnostic <span className="text-rose-600">Engine</span>
                            </h1>
                            <p className="text-stone-500 font-bold text-lg tracking-tight uppercase opacity-60">
                                Morphological Processing Suite • v2.5.0
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="text-right mb-2">
                                <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest pl-1">Session Integrity</span>
                                <div className="flex items-center gap-3 mt-1">
                                    <div className="flex gap-1">
                                        {[...Array(TARGET_IMAGE_COUNT)].map((_, i) => (
                                            <div 
                                                key={i} 
                                                className={`w-2 h-7 rounded-full transition-all duration-700 ${
                                                    i < processedImages.length ? 'bg-rose-600' : 'bg-stone-200'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-3xl font-black text-zinc-950 tabular-nums">
                                        {processedImages.length}<span className="text-stone-300 mx-1">/</span>{TARGET_IMAGE_COUNT}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
                        {/* Left Column: Scanner Controls */}
                        <div className="xl:col-span-4 space-y-6">
                            <div className="bg-zinc-950 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                                
                                <h2 className="text-2xl font-black tracking-tighter mb-8 relative z-10 flex items-center gap-3 uppercase">
                                    Scanner Controls
                                    <div className="h-px flex-grow bg-white/10"></div>
                                </h2>

                                <div className="space-y-8 relative z-10">
                                    {/* Dropzone / Preview */}
                                    <div className="group relative">
                                        {previewUrl ? (
                                            <div className="aspect-video rounded-[30px] overflow-hidden bg-white/5 border border-white/10 relative group">
                                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" disabled={loading || thresholdMet} />
                                                    <span className="bg-white text-zinc-950 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">Change Image</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="aspect-video rounded-[30px] border-2 border-dashed border-white/20 flex flex-col items-center justify-center group-hover:border-rose-500/50 group-hover:bg-rose-500/5 transition-all duration-500">
                                                <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" disabled={loading || thresholdMet} />
                                                <svg className="w-10 h-10 text-rose-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                <p className="font-black text-[10px] tracking-widest uppercase">Load Smear Feed</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress Interaction */}
                                    {analysisProgress.stage && (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">{analysisProgress.message}</span>
                                                <span className="text-xl font-black">{analysisProgress.percentage}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-rose-600 transition-all duration-500" 
                                                    style={{ width: `${analysisProgress.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={!selectedFile || loading || thresholdMet}
                                        className={`
                                            w-full py-6 rounded-[25px] font-black text-xs tracking-[0.2em] uppercase transition-all duration-500
                                            ${(!selectedFile || loading || thresholdMet)
                                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                                : 'bg-rose-600 text-white hover:bg-rose-700 hover:scale-[1.02] active:scale-95 shadow-lg shadow-rose-900/20'}
                                        `}
                                    >
                                        {loading ? 'Processing Array...' : 'Process Image'}
                                    </button>

                                    {/* Session Metrics */}
                                    {processedImages.length > 0 && (
                                        <div className="pt-8 border-t border-white/5">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                                    <p className="text-[10px] font-black text-rose-500 uppercase mb-1">WBC</p>
                                                    <p className="text-xl font-black tabular-nums">{aggregatedCounts.wbc}</p>
                                                </div>
                                                <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                                    <p className="text-[10px] font-black text-stone-400 uppercase mb-1">RBC</p>
                                                    <p className="text-xl font-black tabular-nums">{aggregatedCounts.rbc}</p>
                                                </div>
                                                <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                                    <p className="text-[10px] font-black text-stone-400 uppercase mb-1">PLT</p>
                                                    <p className="text-xl font-black tabular-nums">{aggregatedCounts.platelets}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleReset}
                                                className="w-full mt-6 py-3 border border-white/5 hover:bg-white/5 rounded-[20px] font-black text-[10px] tracking-widest text-white/40 uppercase transition-all"
                                            >
                                                Discard Session
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Clinical Advisory */}
                            <div className="bg-rose-50 rounded-[35px] p-8 border border-rose-100">
                                <h3 className="text-rose-950 font-black text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Clinical Advisory
                                </h3>
                                <p className="text-rose-900/60 text-sm font-bold leading-relaxed">
                                    Ensure adequate field selection to normalize automated differentials. A minimum of {TARGET_IMAGE_COUNT} fields is required for diagnostic validation.
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Dynamic Feed / Matrix */}
                        <div className="xl:col-span-8 space-y-10">
                            {/* Condition: Show Live Feed if not threshold met or results finished */}
                            <div className="space-y-10">
                                {processedImages.length > 0 && (
                                    <div className="bg-white rounded-[40px] p-8 border border-stone-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-10">
                                            <h2 className="text-2xl font-black text-zinc-950 tracking-tighter uppercase">Detection Feed</h2>
                                            <span className="px-4 py-1.5 bg-stone-100 rounded-full text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                                Session Data Capture
                                            </span>
                                        </div>
                                        <ProcessedImagesThumbnails 
                                            processedImages={processedImages} 
                                            currentImageCount={processedImages.length}
                                            targetImageCount={TARGET_IMAGE_COUNT}
                                        />
                                    </div>
                                )}

                                {thresholdMet && finalResults && (
                                    <div className="bg-white rounded-[40px] p-10 border border-stone-200 shadow-xl relative overflow-hidden ring-4 ring-rose-500/5">
                                        <div className="absolute top-0 right-0 p-6">
                                            <div className="px-4 py-2 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200">
                                                Final Report Generated
                                            </div>
                                        </div>
                                        
                                        <div className="mb-12">
                                            <h2 className="text-4xl font-black text-zinc-950 tracking-tighter mb-2 uppercase italic underline decoration-rose-600 decoration-8 underline-offset-8">Diagnostic Matrix</h2>
                                            <p className="text-stone-400 font-bold text-xs uppercase tracking-[0.2em] mt-6">
                                                Multi-stage morphological consensus • {processedImages.length} Samples
                                            </p>
                                        </div>

                                        <div className="space-y-12">
                                            <ThresholdResults 
                                                counts={aggregatedCounts}
                                                wbcCounts={aggregatedClassifications} // Logic matches backup/original usage
                                                processedImages={processedImages}
                                            />
                                            
                                            <div className="pt-12 border-t border-stone-100">
                                                <FinalResults 
                                                    aggregatedResults={finalResults}
                                                    processedImages={processedImages}
                                                    onReset={handleReset}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentResults && showCurrentResults && !thresholdMet && (
                                    <div className="bg-white rounded-[40px] p-8 border border-stone-200 shadow-lg animate-in fade-in slide-in-from-bottom-5">
                                        <div className="flex items-center justify-between mb-8">
                                            <h2 className="text-2xl font-black text-zinc-950 tracking-tighter uppercase underline decoration-rose-500 decoration-4">Live Analysis</h2>
                                            <button 
                                                onClick={() => setShowCurrentResults(false)}
                                                className="text-stone-400 hover:text-rose-600 transition-colors"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            <div className="space-y-6">
                                                <div className="relative rounded-[30px] overflow-hidden border-2 border-stone-100 group shadow-inner">
                                                    <img 
                                                        src={`data:image/jpeg;base64,${currentResults.annotated_image}`}
                                                        alt="Annotated" 
                                                        className="w-full h-auto"
                                                    />
                                                    <div className="absolute bottom-4 right-4 bg-zinc-950/90 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                                                        Raw Neural Feed
                                                    </div>
                                                </div>
                                                
                                                {currentResults.cropped_cells && (
                                                    <button
                                                        onClick={() => navigate('/classifications', {
                                                            state: { 
                                                                croppedCells: currentResults.cropped_cells,
                                                                wbcClassifications: currentResults.stage2_classification,
                                                                summary: currentResults.summary,
                                                                results: currentResults,
                                                                previewUrl: previewUrl,
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
                                                        className="w-full py-4 bg-zinc-950 text-white rounded-[20px] font-black text-[10px] tracking-widest uppercase hover:bg-rose-600 transition-all flex items-center justify-center gap-3"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Explore Morphological Data ({currentResults.cropped_cells.length})
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-8">
                                                <div className="bg-stone-50 rounded-[30px] p-6 border border-stone-100">
                                                    <h3 className="text-zinc-950 font-black text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                                                        <div className="w-1 h-3 bg-rose-500 rounded-full"></div>
                                                        Morphological Consensus
                                                    </h3>
                                                    <div className="space-y-4">
                                                        {Object.entries(
                                                            currentResults.stage2_classification?.reduce((acc, curr) => {
                                                                const cls = curr.classification || 'Unknown';
                                                                acc[cls] = (acc[cls] || 0) + 1;
                                                                return acc;
                                                            }, {}) || {}
                                                        ).map(([type, count]) => {
                                                            const percentage = (count / (currentResults.stage2_classification?.length || 1)) * 100;
                                                            return (
                                                                <div key={type} className="group">
                                                                    <div className="flex justify-between text-[10px] font-black mb-1.5 uppercase">
                                                                        <span className="text-zinc-400 group-hover:text-zinc-950 transition-colors">{type}</span>
                                                                        <span className="text-rose-600">{count} Units</span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-zinc-950 rounded-full transition-all duration-500" 
                                                                            style={{ width: `${percentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <DiseaseInterpretation 
                                                    diseaseInterpretation={currentResults.disease_interpretation}
                                                    clinicalThresholds={null}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!loading && processedImages.length === 0 && (
                                    <div className="h-[600px] border-2 border-dashed border-stone-200 rounded-[40px] flex flex-col items-center justify-center text-center p-12 group transition-all duration-500 hover:border-rose-200 hover:bg-rose-50/5">
                                        <div className="w-24 h-24 bg-stone-100 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-rose-100 transition-all duration-500 shadow-sm border border-stone-200">
                                            <svg className="w-12 h-12 text-stone-300 group-hover:text-rose-500 transition-colors font-thin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-2xl font-black text-zinc-950 tracking-tighter uppercase mb-2">Diagnostic Engine Idle</h3>
                                        <p className="text-stone-400 font-bold text-xs uppercase tracking-widest max-w-sm">
                                            Initialize morphological pipeline by uploading peripheral film samples.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default Homepage;