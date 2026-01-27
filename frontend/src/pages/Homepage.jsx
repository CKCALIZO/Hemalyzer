import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";
import { DiseaseInterpretation } from "../components/DiseaseInterpretation.jsx";
import { FinalResults } from "../components/FinalResults.jsx";
import { ProcessedImagesThumbnails } from "../components/ProcessedImagesThumbnails.jsx";
import { saveSession, loadSession, clearSession, migrateFromLocalStorage } from "../utils/sessionStorage.js";

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

    // Bulk upload state
    const [bulkFiles, setBulkFiles] = useState([]);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [imageProgress, setImageProgress] = useState(0); // Per-image progress percentage (0-100)
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [showClassificationsModal, setShowClassificationsModal] = useState(false);

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
        // If no location state, try to restore from IndexedDB (page reload)
        else {
            // Wrap async code in IIFE since useEffect can't be async
            (async () => {
                try {
                    // First, migrate any old localStorage session to IndexedDB
                    await migrateFromLocalStorage();

                    // Load session from IndexedDB
                    const session = await loadSession();
                    if (session) {
                        console.log('Restoring session from IndexedDB:', session);
                        console.log('Session has processedImages:', session.processedImages?.length);
                        console.log('Session thresholdMet:', session.thresholdMet);
                        console.log('Session has finalResults:', !!session.finalResults);

                        // Set all states from session
                        if (session.processedImages) setProcessedImages(session.processedImages);
                        if (session.aggregatedCounts) setAggregatedCounts(session.aggregatedCounts);
                        if (session.aggregatedClassifications) setAggregatedClassifications(session.aggregatedClassifications);
                        if (session.aggregatedRBCClassifications) setAggregatedRBCClassifications(session.aggregatedRBCClassifications);
                        if (session.currentResults) setCurrentResults(session.currentResults);

                        // Handle threshold and final results
                        const isThresholdMet = session.thresholdMet === true ||
                            (session.processedImages && session.processedImages.length >= TARGET_IMAGE_COUNT);

                        if (isThresholdMet) {
                            console.log('Threshold met - setting thresholdMet=true and restoring finalResults if available');
                            setThresholdMet(true);

                            // If finalResults exists in session, use it
                            // Otherwise, the safety effect will recalculate it
                            if (session.finalResults) {
                                console.log('Using saved finalResults from session');
                                setFinalResults(session.finalResults);
                            } else {
                                console.log('No finalResults in session - safety effect will recalculate');
                                // Don't call calculateFinalResults here - it may not be defined yet
                                // The safety effect will handle recalculation
                            }
                        } else {
                            setThresholdMet(false);
                            setFinalResults(null);
                        }
                    }
                } catch (error) {
                    console.log('No valid session to restore:', error);
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // Safety effect: Sync thresholdMet and finalResults when processedImages reaches target
    // This handles edge cases where states get out of sync after page reload
    useEffect(() => {
        const shouldHaveThreshold = processedImages.length >= TARGET_IMAGE_COUNT;

        // If we have 10+ images but thresholdMet is false, fix it
        if (shouldHaveThreshold && !thresholdMet) {
            console.log('Safety sync: Setting thresholdMet to true (have', processedImages.length, 'images)');
            setThresholdMet(true);
        }

        // If thresholdMet is true but finalResults is null, recalculate
        if (shouldHaveThreshold && thresholdMet && !finalResults && aggregatedClassifications.length > 0) {
            console.log('Safety sync: Recalculating finalResults');
            const recalculatedResults = calculateFinalResults(
                aggregatedClassifications,
                processedImages,
                aggregatedCounts,
                aggregatedRBCClassifications
            );
            setFinalResults(recalculatedResults);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedImages.length, thresholdMet, finalResults, aggregatedClassifications.length, aggregatedCounts, aggregatedRBCClassifications]);

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

        // CML Analysis - based on granulocyte (CML-classified cells) percentage
        // Thresholds from disease_thresholds.py:
        // <60% = Normal, 60-75% = Reactive, 76-89% = Early CML, 90-95% = Chronic Phase, >95% = Accelerated
        if (cmlCount > 0) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';

            if (cmlPercentage > 95) {
                interpretation = 'Accelerated Phase CML - extreme granulocytic proliferation';
                condition = 'Chronic Myeloid Leukemia (Accelerated Phase)';
                severity = 'HIGH';
            } else if (cmlPercentage >= 90) {
                interpretation = 'Typical Chronic Phase CML - granulocytes dominate differential';
                condition = 'Chronic Myeloid Leukemia (Chronic Phase)';
                severity = 'HIGH';
            } else if (cmlPercentage >= 76) {
                interpretation = 'Suspicious for Early Chronic Myeloid Leukemia (CML - Chronic Phase)';
                condition = 'Suspicious for Early CML';
                severity = 'MODERATE';
            } else if (cmlPercentage >= 60) {
                interpretation = 'Reactive / Secondary Leukocytosis (CML) - mild granulocytic predominance';
                condition = 'Reactive Leukocytosis';
                severity = 'LOW';
            } else {
                interpretation = 'Normal differential count - balanced white cell maturation';
                condition = 'Normal granulocyte count';
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

        // CLL Analysis - based on lymphocyte (CLL-classified cells) percentage
        // Thresholds from disease_thresholds.py:
        // <20% = Normal, 20-40% = Reactive, 41-60% = Early CLL, 61-80% = Typical CLL, >80% = Advanced CLL
        if (cllCount > 0) {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';

            if (cllPercentage > 80) {
                interpretation = 'Advanced / Progressive CLL - lymphocytes dominate smear';
                condition = 'Chronic Lymphocytic Leukemia (Advanced/Progressive)';
                severity = 'HIGH';
            } else if (cllPercentage >= 61) {
                interpretation = 'Typical Chronic Lymphocytic Leukemia (CLL)';
                condition = 'Chronic Lymphocytic Leukemia (CLL)';
                severity = 'HIGH';
            } else if (cllPercentage >= 41) {
                interpretation = 'Suspicious for Early / Smoldering CLL';
                condition = 'Suspicious for Early CLL';
                severity = 'MODERATE';
            } else if (cllPercentage >= 20) {
                interpretation = 'Reactive / Secondary Lymphocytosis - may occur with viral infections';
                condition = 'Reactive Lymphocytosis';
                severity = 'LOW';
            } else {
                interpretation = 'Normal lymphocyte count - balanced white cell differential';
                condition = 'Normal lymphocyte count';
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
            avgRBCPerField: averageRBCPerImage,
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
                    // Save session to IndexedDB (non-blocking)
                    saveSession(sessionState).catch(err => {
                        console.error('Failed to save session:', err);
                        setError('Warning: Session could not be saved for page reload.');
                    });
                    console.log('Session saved to IndexedDB:', sessionState);
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
    const handleReset = async () => {
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
        // Clear bulk upload state
        setBulkFiles([]);
        setBulkProgress({ current: 0, total: 0 });
        setImageProgress(0);
        setIsBulkProcessing(false);

        // Clear saved session from IndexedDB and localStorage
        try {
            await clearSession();
            // Also clear any localStorage fallbacks
            localStorage.removeItem('hemalyzer_session_fallback');
            localStorage.removeItem('hemalyzer_current_session');
            console.log('Session fully cleared from all storage');
        } catch (err) {
            console.error('Failed to clear session:', err);
        }
    };

    // Handle bulk file selection
    const handleBulkFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Calculate remaining images needed
            const remaining = TARGET_IMAGE_COUNT - processedImages.length;
            const maxAllowed = Math.min(remaining, 10);

            // Check if user tried to select more than allowed
            if (files.length > maxAllowed) {
                // Show warning about file limit
                setError(`Only ${maxAllowed} more image${maxAllowed !== 1 ? 's' : ''} needed. Selected first ${maxAllowed} of ${files.length} images.`);
            } else {
                setError(null);
            }

            // Limit to allowed max
            const filesToProcess = files.slice(0, maxAllowed);
            setBulkFiles(filesToProcess);
        }
    };

    // Process a single image and return the result (used by bulk processing)
    const processSingleImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('conf_threshold', '0.2');
        formData.append('iou_threshold', '0.2');

        const response = await fetch(`${API_URL}/api/analyze`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        return data;
    };

    // Handle bulk upload and sequential processing
    const handleBulkUpload = async () => {
        if (bulkFiles.length === 0) {
            setError('Please select images first');
            return;
        }

        if (thresholdMet) {
            setError('Analysis complete. Click "New Analysis" to start over.');
            return;
        }

        setIsBulkProcessing(true);
        setLoading(true);
        setError(null);
        setShowCurrentResults(true);
        setBulkProgress({ current: 0, total: bulkFiles.length });

        let currentProcessedImages = [...processedImages];
        let currentCounts = { ...aggregatedCounts };
        let currentClassifications = [...aggregatedClassifications];
        let currentRBCClassifications = [...aggregatedRBCClassifications];

        try {
            for (let i = 0; i < bulkFiles.length; i++) {
                const file = bulkFiles[i];

                // Reset per-image progress
                setImageProgress(0);

                // Update bulk progress count
                setBulkProgress({ current: i, total: bulkFiles.length });
                setAnalysisProgress({
                    stage: 'bulk',
                    percentage: 0,
                    message: `Processing image ${i + 1} of ${bulkFiles.length}: ${file.name}`
                });

                // Start simulated progress animation (0% to 90% over ~3 seconds)
                let simulatedProgress = 0;
                const progressInterval = setInterval(() => {
                    simulatedProgress += Math.random() * 15 + 5; // Random increment 5-20%
                    if (simulatedProgress > 90) simulatedProgress = 90;
                    setImageProgress(Math.round(simulatedProgress));
                    setAnalysisProgress(prev => ({
                        ...prev,
                        percentage: Math.round(simulatedProgress)
                    }));
                }, 300);

                // Process this image
                const data = await processSingleImage(file);

                // Stop the simulated progress and jump to 100%
                clearInterval(progressInterval);
                setImageProgress(100);
                setAnalysisProgress(prev => ({
                    ...prev,
                    percentage: 100
                }));

                // Brief pause to show 100% completion
                await new Promise(resolve => setTimeout(resolve, 200));

                if (data.success) {
                    // Extract counts
                    const wbcCount = data.stage1_detection?.counts?.WBC || 0;
                    const rbcCount = data.stage1_detection?.counts?.RBC || 0;
                    const plateletCount = data.stage1_detection?.counts?.Platelets || 0;
                    const sickleCount = data.summary?.sickle_cell_count || 0;

                    // Create processed image record
                    const processedImage = {
                        id: Date.now() + i,
                        fileName: file.name,
                        preview: URL.createObjectURL(file),
                        annotated: data.annotated_image,
                        wbcCount,
                        rbcCount,
                        plateletCount,
                        sickleCount,
                        classifications: data.stage2_classification || [],
                        results: data
                    };

                    // Update local tracking variables
                    currentCounts = {
                        wbc: currentCounts.wbc + wbcCount,
                        rbc: currentCounts.rbc + rbcCount,
                        platelets: currentCounts.platelets + plateletCount
                    };

                    // Get classifications with cropped images
                    const classificationsWithImages = (data.stage2_classification || []).map((cls) => {
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

                    currentClassifications = [...currentClassifications, ...classificationsWithImages];

                    // RBC classifications
                    const rbcCells = (data.cropped_cells || []).filter(cell => cell.cell_type === 'RBC');
                    currentRBCClassifications = [...currentRBCClassifications, ...rbcCells];

                    // Add to processed images
                    currentProcessedImages = [...currentProcessedImages, processedImage];

                    // Update state after each image
                    setProcessedImages(currentProcessedImages);
                    setAggregatedCounts(currentCounts);
                    setAggregatedClassifications(currentClassifications);
                    setAggregatedRBCClassifications(currentRBCClassifications);
                    setCurrentResults(data);
                    setPreviewUrl(URL.createObjectURL(file));

                    // Check if threshold is met
                    if (currentProcessedImages.length >= TARGET_IMAGE_COUNT) {
                        setThresholdMet(true);
                        const finalCalc = calculateFinalResults(currentClassifications, currentProcessedImages, currentCounts, currentRBCClassifications);
                        setFinalResults(finalCalc);

                        // Save session
                        const sessionState = {
                            processedImages: currentProcessedImages,
                            aggregatedCounts: currentCounts,
                            aggregatedClassifications: currentClassifications,
                            aggregatedRBCClassifications: currentRBCClassifications,
                            thresholdMet: true,
                            finalResults: finalCalc,
                            currentResults: data,
                            timestamp: Date.now()
                        };
                        saveSession(sessionState).catch(err => console.error('Failed to save session:', err));
                        break; // Stop processing, threshold met
                    }
                } else {
                    console.error(`Failed to process image ${file.name}:`, data.error);
                }
            }

            // Final save if threshold not yet met
            if (currentProcessedImages.length < TARGET_IMAGE_COUNT) {
                const sessionState = {
                    processedImages: currentProcessedImages,
                    aggregatedCounts: currentCounts,
                    aggregatedClassifications: currentClassifications,
                    aggregatedRBCClassifications: currentRBCClassifications,
                    thresholdMet: false,
                    finalResults: null,
                    currentResults: currentProcessedImages[currentProcessedImages.length - 1]?.results || null,
                    timestamp: Date.now()
                };
                saveSession(sessionState).catch(err => console.error('Failed to save session:', err));
            }

            setAnalysisProgress({ stage: 'complete', percentage: 100, message: 'Bulk upload complete!' });
            setTimeout(() => {
                setAnalysisProgress({ stage: '', percentage: 0, message: '' });
            }, 2000);

        } catch (err) {
            setError(`Bulk upload failed: ${err.message}`);
            setAnalysisProgress({ stage: '', percentage: 0, message: '' });
        } finally {
            setLoading(false);
            setIsBulkProcessing(false);
            setBulkFiles([]);
            setBulkProgress({ current: 0, total: 0 });
            setImageProgress(0);
            // Reset bulk file input
            const bulkInput = document.getElementById('bulk-upload');
            if (bulkInput) bulkInput.value = '';
        }
    };


    // Save report to localStorage with complete analysis data
    const saveReport = () => {
        console.log('saveReport called - finalResults:', !!finalResults);

        try {
            if (!finalResults) {
                alert('No final results to save. Please complete the analysis first.');
                return;
            }

            const reports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
            const newReport = {
                id: Date.now(),
                timestamp: new Date().toLocaleString(),
                // Include complete analysis data (without heavy base64 images)
                data: {
                    thresholdMet: finalResults?.thresholdMet,
                    totalWBC: finalResults?.totalWBC,
                    totalRBC: finalResults?.totalRBC,
                    totalPlatelets: finalResults?.totalPlatelets,
                    estimatedWBCCount: finalResults?.estimatedWBCCount,
                    estimatedRBCCount: finalResults?.estimatedRBCCount,
                    wbcDifferential: finalResults?.wbcDifferential,
                    diseaseFindings: finalResults?.diseaseFindings,
                    sickleCount: finalResults?.sickleCount,
                    abnormalWBCs: finalResults?.abnormalWBCs?.length || 0
                },
                // Add session metadata (WITHOUT processedImages which contains base64 data)
                sessionData: {
                    imageCount: processedImages.length,
                    aggregatedCounts: aggregatedCounts,
                    // Store classification summaries, not full data
                    wbcClassificationCount: aggregatedClassifications?.length || 0,
                    rbcClassificationCount: aggregatedRBCClassifications?.length || 0,
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
        } catch (error) {
            console.error('Error saving report:', error);

            // Handle localStorage quota exceeded error
            if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
                // Clear the corrupted/oversized reports and try again
                localStorage.removeItem('hemalyzer_reports');
                alert('Storage was full. Old reports have been cleared. Please click Save Report again.');
            } else {
                alert('Failed to save report: ' + error.message);
            }
        }
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
                                saveReport={saveReport}
                            />
                        </div>
                    )}

                    {/* Main Content Grid */}
                    {!thresholdMet && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            {/* Upload Section */}
                            <div className="bg-white rounded-lg border border-rose-200 shadow-sm h-fit">
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
                                                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
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

                                    {/* Single File Input */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-rose-700 mb-2">Single Image Upload</label>
                                        <input
                                            className="block w-full text-sm text-rose-700 border border-rose-300 
                                            rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 
                                            focus:ring-rose-400 p-2"
                                            id="pbs-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            disabled={loading || thresholdMet || isBulkProcessing}
                                        />
                                    </div>

                                    {/* Divider */}
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-rose-200"></div>
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="bg-white px-3 text-rose-500 font-medium">OR</span>
                                        </div>
                                    </div>

                                    {/* Bulk Upload Section */}
                                    <div className="mb-4 p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg border border-rose-200">
                                        <label className="block text-sm font-medium text-rose-700 mb-2">
                                            Bulk Upload (up to {TARGET_IMAGE_COUNT - processedImages.length} images)
                                        </label>
                                        <input
                                            className="block w-full text-sm text-rose-700 border border-rose-300 
                                            rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 
                                            focus:ring-rose-400 p-2 mb-3"
                                            id="bulk-upload"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleBulkFileChange}
                                            disabled={loading || thresholdMet || isBulkProcessing}
                                        />

                                        {/* Selected files preview */}
                                        {bulkFiles.length > 0 && (
                                            <div className="mb-3 p-3 bg-white rounded-lg border border-rose-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-sm font-medium text-rose-800">
                                                        ✓ {bulkFiles.length} image{bulkFiles.length > 1 ? 's' : ''} selected:
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            setBulkFiles([]);
                                                            setError(null);
                                                            const bulkInput = document.getElementById('bulk-upload');
                                                            if (bulkInput) bulkInput.value = '';
                                                        }}
                                                        disabled={isBulkProcessing}
                                                        className="text-xs px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded transition-colors disabled:opacity-50"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                                    {bulkFiles.map((file, idx) => (
                                                        <span key={idx} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded">
                                                            {file.name.length > 15 ? file.name.slice(0, 12) + '...' : file.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Insufficient images memo */}
                                        {bulkFiles.length > 0 && bulkFiles.length < (TARGET_IMAGE_COUNT - processedImages.length) && !isBulkProcessing && (
                                            <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-300 flex items-start gap-2">
                                                <span className="text-amber-600 font-bold">Note:</span>
                                                <div>
                                                    <p className="text-sm font-medium text-amber-800">
                                                        {bulkFiles.length} of {TARGET_IMAGE_COUNT - processedImages.length} images selected
                                                    </p>
                                                    <p className="text-xs text-amber-700 mt-1">
                                                        You can still process these, but for accurate results please upload {TARGET_IMAGE_COUNT - processedImages.length} images total.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Bulk Progress Display */}
                                        {isBulkProcessing && (
                                            <div className="mb-3 p-3 bg-rose-100 rounded-lg border border-rose-300">
                                                <p className="text-sm font-semibold text-rose-800">
                                                    Processed: {bulkProgress.current} / {bulkProgress.total} images
                                                </p>
                                                <div className="w-full h-2 bg-rose-200 rounded-full mt-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-rose-600 transition-all duration-300"
                                                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Process Bulk Button */}
                                        <button
                                            onClick={handleBulkUpload}
                                            disabled={bulkFiles.length === 0 || loading || thresholdMet || isBulkProcessing}
                                            className={`w-full flex items-center justify-center gap-2 text-white 
                                            bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 
                                            transition-all font-semibold rounded-lg text-sm px-4 py-2.5
                                            ${(bulkFiles.length === 0 || loading || thresholdMet || isBulkProcessing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-md hover:shadow-lg'}`}
                                        >
                                            {isBulkProcessing ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Processed {bulkProgress.current}/{bulkProgress.total}...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    Process {bulkFiles.length > 0 ? bulkFiles.length : ''} Images at Once
                                                </>
                                            )}
                                        </button>
                                    </div>


                                    {/* Analysis Progress Bar - Shows during image processing AND for 2s after completion */}
                                    {analysisProgress.stage && (
                                        <div className={`mb-4 p-4 rounded-lg border ${analysisProgress.stage === 'complete'
                                            ? 'bg-emerald-50 border-emerald-300'
                                            : 'bg-rose-50 border-rose-300'
                                            }`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`text-sm font-medium ${analysisProgress.stage === 'complete'
                                                    ? 'text-emerald-800'
                                                    : 'text-rose-800'
                                                    }`}>
                                                    {analysisProgress.message}
                                                </span>
                                                <span className={`text-sm font-semibold ${analysisProgress.stage === 'complete'
                                                    ? 'text-emerald-600'
                                                    : 'text-rose-600'
                                                    }`}>
                                                    {analysisProgress.percentage}%
                                                </span>
                                            </div>
                                            <div className={`w-full h-2.5 rounded-full overflow-hidden ${analysisProgress.stage === 'complete'
                                                ? 'bg-emerald-200'
                                                : 'bg-rose-200'
                                                }`}>
                                                <div
                                                    className={`h-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${analysisProgress.stage === 'complete'
                                                        ? 'bg-emerald-500'
                                                        : 'bg-gradient-to-r from-rose-400 to-rose-600'
                                                        }`}
                                                    style={{ width: `${analysisProgress.percentage}%` }}
                                                />
                                            </div>
                                            {/* Only show step indicators for single image processing, not bulk */}
                                            {analysisProgress.stage !== 'bulk' && (
                                                <div className={`mt-3 flex items-center justify-between text-xs ${analysisProgress.stage === 'complete'
                                                    ? 'text-emerald-700'
                                                    : 'text-rose-700'
                                                    }`}>
                                                    <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 10 ? 'font-semibold scale-105' : 'opacity-50'
                                                        }`}>
                                                        <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 10 ? 'text-emerald-500' : ''}`}>
                                                            {analysisProgress.percentage >= 10 ? '✓' : '○'}
                                                        </span>
                                                        <span>Upload</span>
                                                    </div>
                                                    <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 30 ? 'font-semibold scale-105' : 'opacity-50'
                                                        }`}>
                                                        <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 30 ? 'text-emerald-500' : ''}`}>
                                                            {analysisProgress.percentage >= 30 ? '✓' : '○'}
                                                        </span>
                                                        <span>Detection</span>
                                                    </div>
                                                    <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 60 ? 'font-semibold scale-105' : 'opacity-50'
                                                        }`}>
                                                        <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 60 ? 'text-emerald-500' : ''}`}>
                                                            {analysisProgress.percentage >= 60 ? '✓' : '○'}
                                                        </span>
                                                        <span>Classification</span>
                                                    </div>
                                                    <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 85 ? 'font-semibold scale-105' : 'opacity-50'
                                                        }`}>
                                                        <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 85 ? 'text-emerald-500' : ''}`}>
                                                            {analysisProgress.percentage >= 85 ? '✓' : '○'}
                                                        </span>
                                                        <span>Analysis</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                            <div className="bg-white rounded-lg border border-rose-200 shadow-sm flex flex-col">
                                <div className="px-6 py-4 border-b border-rose-200 bg-rose-50 flex items-center justify-between flex-shrink-0">
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

                                <div className="p-6 overflow-y-auto flex-1">
                                    {!currentResults && !loading && (
                                        <div className="text-center py-8">
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
                                                    onClick={() => {
                                                        if (isBulkProcessing || loading) {
                                                            // During processing, open modal instead of navigating
                                                            setShowClassificationsModal(true);
                                                        } else {
                                                            // When not processing, navigate normally
                                                            navigate('/classifications', {
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
                                                            });
                                                        }
                                                    }}
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

            {/* Cell Classifications Modal - Shows during processing instead of navigating */}
            {showClassificationsModal && currentResults?.cropped_cells && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowClassificationsModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-rose-700 text-white px-6 py-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold">Cell Classifications ({currentResults.cropped_cells.length} cells)</h2>
                            <button
                                onClick={() => setShowClassificationsModal(false)}
                                className="text-white hover:bg-rose-600 rounded-full p-1 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body - Scrollable Grid */}
                        <div className="p-4 overflow-y-auto max-h-[calc(85vh-120px)]">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                                {currentResults.cropped_cells.map((cell, idx) => {
                                    // Get classification from stage2_classification if available
                                    const wbcClassification = currentResults.stage2_classification?.find(c => c.wbc_id === cell.wbc_id);
                                    // Use cell.classification (from cropped_cells) or fallback to stage2 classification
                                    const displayClassification = cell.classification || wbcClassification?.classification || wbcClassification?.predicted_class || 'Unknown';

                                    // Determine color based on classification
                                    const isAbnormal = displayClassification && !displayClassification.toLowerCase().includes('normal');
                                    const borderColor = isAbnormal ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50';

                                    return (
                                        <div key={cell.wbc_id || idx} className={`rounded-lg overflow-hidden border-2 ${borderColor}`}>
                                            {cell.cropped_image && (
                                                <div className="aspect-square">
                                                    <img
                                                        src={`data:image/png;base64,${cell.cropped_image}`}
                                                        alt={`${cell.cell_type} - ${displayClassification}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                            <div className="p-2">
                                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                    {cell.cell_type || 'WBC'}
                                                </p>
                                                <p className="text-xs font-medium text-slate-800 truncate" title={displayClassification}>
                                                    {displayClassification}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-between items-center">
                            <p className="text-sm text-slate-600">
                                {isBulkProcessing ? 'Processing in progress...' : 'Processing complete'}
                            </p>
                            <button
                                onClick={() => setShowClassificationsModal(false)}
                                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Homepage;