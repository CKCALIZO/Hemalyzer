
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { saveSession, loadSession, clearSession, migrateFromLocalStorage } from '../utils/sessionStorage';
import { API_URL, getApiHeaders } from '../config/api';

const AnalysisContext = createContext();
const TARGET_IMAGE_COUNT = 10;
const RBC_MULTIPLIER = 200000;
const WBC_MULTIPLIER = 2000;
const NUM_FIELDS = 10;

// // --- Classification Helper ---
// Map new 7-class model names to short labels
const CLASS_LABELS = {
    'Normal WBC': { short: 'Normal', isDisease: false, isRBC: false },
    'Normal RBC': { short: 'Normal RBC', isDisease: false, isRBC: true },
    'Acute Lymphoblastic Leukemia': { short: 'ALL', isDisease: true, isRBC: false },
    'Acute Myeloid Leukemia': { short: 'AML', isDisease: true, isRBC: false },
    'Chronic Lymphocytic Leukemia': { short: 'CLL', isDisease: true, isRBC: false },
    'Chronic Myeloid Leukemia': { short: 'CML', isDisease: true, isRBC: false },
    'Sickle Cell Anemia': { short: 'SCA', isDisease: true, isRBC: true },
};

const getClassInfo = (classification) => {
    if (!classification) return { short: 'Unknown', isDisease: false, isRBC: false };
    return CLASS_LABELS[classification] || { short: classification, isDisease: false, isRBC: false };
};

// Sickle Cell Classification Analysis Helper
const getSickleCellAnalysis = (severity) => {
    if (severity === 'SEVERE') {
        return {
            interpretation: 'Severe Sickle Cell classification (HbSS): High percentage of sickled cells detected. Above severe threshold (> 30%).',
            recommendation: 'Note: Classification consistent with severe sickling. HbSS threshold met.'
        };
    } else if (severity === 'MODERATE') {
        return {
            interpretation: 'Moderate Sickling: Significant presence of sickled cells. Above moderate threshold (10-30%).',
            recommendation: 'Note: Moderate sickling threshold met. Further evaluation may be warranted.'
        };
    } else if (severity === 'MILD') {
        return {
            interpretation: 'Mild Sickling (HbAS): Lower percentage of sickled cells. Above trait threshold (3-10%).',
            recommendation: 'Note: Sickle Cell Trait threshold met (HbAS classification).'
        };
    } else {
        return {
            interpretation: 'Normal / Trace: Sickle cells absent or present in trace amounts (< 3%) below classification threshold.',
            recommendation: 'Note: Below classification threshold. No sickling classification.'
        };
    }
};

// Classification Recommendations
const getDiseaseRecommendation = (type, severity) => {
    if (severity === 'HIGH') {
        if (type === 'AML') return 'Blast Phase (>= 20% blasts). Classification threshold reached.';
        if (type === 'ALL') return 'Lymphoblast Phase (>= 20% lymphoblasts). Classification threshold reached.';
        if (type === 'CML') return 'Blast Phase / Blast Crisis (>= 20% blasts). Classification threshold reached.';
        if (type === 'CLL') return 'Advanced/Untreated CLL (> 70% abnormal lymphocytes). High classification threshold reached.';
        return `Classification threshold reached for ${type}.`;
    } else if (severity === 'MODERATE') {
        if (type === 'CML') return 'Accelerated Phase (10-19% blasts). Accelerated phase threshold reached.';
        if (type === 'CLL') return 'Typical CLL pattern (50-70% abnormal lymphocytes). Moderate classification threshold reached.';
        return `Moderate classification level for ${type}.`;
    } else if (severity === 'LOW') {
        if (type === 'CML') return 'Chronic Phase (< 10% blasts). Below accelerated phase threshold.';
        if (type === 'CLL') return 'Suspicious Lymphocytosis (40-50%). Above monitoring threshold.';
        return `Low classification level detected.`;
    } else {
        return `Below classification threshold. Within normal range.`;
    }
};

export const AnalysisProvider = ({ children }) => {
    // Patient Data State
    const [patientName, setPatientName] = useState('');
    const [patientId, setPatientId] = useState('');
    const [patientAge, setPatientAge] = useState('');
    const [patientGender, setPatientGender] = useState('Male');
    const [patientPhone, setPatientPhone] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);

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
        wbc: 0, rbc: 0, platelets: 0
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
    const [imageProgress, setImageProgress] = useState(0);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // Abort controller for cancelling in-flight requests
    const abortControllerRef = useRef(null);
    const cancelledRef = useRef(false);

    // Cancel/End Session function
    const cancelAnalysis = useCallback(() => {
        // Abort any in-flight fetch requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        cancelledRef.current = true;

        // Reset processing states
        setLoading(false);
        setIsBulkProcessing(false);
        setBulkProgress({ current: 0, total: 0 });
        setAnalysisProgress({ stage: '', percentage: 0, message: '' });
        setError('Analysis cancelled by user.');
        setBulkFiles([]);
        setSelectedFile(null);
        setPreviewUrl(null);
    }, []);

    // Calculate aggregated results - Simplified for 7-class model
    const calculateFinalResults = useCallback((allClassifications, allProcessedImages, counts, allRBCClassifications = []) => {
        const wbcTypeCounts = {};
        let normalWBCCount = 0;
        let amlCount = 0, allCount = 0, cmlCount = 0, cllCount = 0;
        const abnormalWBCs = [];

        allClassifications.forEach(cls => {
            const classification = cls.classification || '';
            wbcTypeCounts[classification] = (wbcTypeCounts[classification] || 0) + 1;
            const info = getClassInfo(classification);

            if (info.isDisease && !info.isRBC) {
                abnormalWBCs.push(cls);
            }

            // Count by disease type using direct class names
            if (classification === 'Normal WBC') normalWBCCount++;
            else if (classification === 'Acute Myeloid Leukemia') amlCount++;
            else if (classification === 'Acute Lymphoblastic Leukemia') allCount++;
            else if (classification === 'Chronic Myeloid Leukemia') cmlCount++;
            else if (classification === 'Chronic Lymphocytic Leukemia') cllCount++;
        });

        const totalImagesProcessed = allProcessedImages.length;
        const averageRBCPerImage = totalImagesProcessed > 0 ? counts.rbc / totalImagesProcessed : 0;
        const estimatedRBCCount = Math.round((averageRBCPerImage / 10) * RBC_MULTIPLIER);
        const estimatedWBCCount = Math.round((counts.wbc / NUM_FIELDS) * WBC_MULTIPLIER);
        const totalWBC = counts.wbc;
        const diseaseWBCCount = amlCount + allCount + cmlCount + cllCount;

        const diseaseFindings = [];

        // AML: Standard criteria - ≥20% blasts = Blast Phase
        const classifyAML = (count) => {
            if (count === 0) return null;
            const pct = totalWBC > 0 ? (count / totalWBC) * 100 : 0;
            let interpretation, severity, condition;
            if (pct >= 20) {
                interpretation = 'Blast Phase - >= 20% blasts detected. AML blast phase classification threshold reached.';
                severity = 'HIGH'; condition = 'Blast Phase (>= 20% blasts)';
            } else {
                interpretation = 'Blasts detected below classification threshold (< 20%).';
                severity = 'BELOW_THRESHOLD'; condition = `Below classification threshold (${pct.toFixed(1)}% blasts)`;
            }
            return { type: 'AML (Acute Myeloid Leukemia)', percentage: pct, interpretation, severity,
                condition, breakdown: { 'AML Cells': count }, recommendation: getDiseaseRecommendation('AML', severity) };
        };

        // ALL: Standard criteria - ≥20% lymphoblasts = diagnostic threshold
        const classifyALL = (count) => {
            if (count === 0) return null;
            const pct = totalWBC > 0 ? (count / totalWBC) * 100 : 0;
            let interpretation, severity, condition;
            if (pct >= 20) {
                interpretation = 'Lymphoblast Phase - >= 20% lymphoblasts detected. ALL lymphoblast classification threshold reached.';
                severity = 'HIGH'; condition = 'Lymphoblast Phase (>= 20% lymphoblasts)';
            } else {
                interpretation = 'Lymphoblasts detected below classification threshold (< 20%).';
                severity = 'BELOW_THRESHOLD'; condition = `Below classification threshold (${pct.toFixed(1)}% lymphoblasts)`;
            }
            return { type: 'ALL (Acute Lymphoblastic Leukemia)', percentage: pct, interpretation, severity,
                condition, breakdown: { 'ALL Cells': count }, recommendation: getDiseaseRecommendation('ALL', severity) };
        };

        // CML: Phase-based - <10% Chronic, 10-19% Accelerated, ≥20% Blast
        const classifyCML = (count) => {
            if (count === 0) return null;
            const pct = totalWBC > 0 ? (count / totalWBC) * 100 : 0;
            let interpretation, severity, condition;
            if (pct >= 20) {
                interpretation = 'Blast Phase (Blast Crisis) - >= 20% blasts. CML advanced to blast crisis stage.';
                severity = 'HIGH'; condition = 'Blast Phase / Blast Crisis (>= 20% blasts)';
            } else if (pct >= 10) {
                interpretation = 'Accelerated Phase - blasts 10-19%. Intermediate threshold met.';
                severity = 'MODERATE'; condition = 'Accelerated Phase (10-19% blasts)';
            } else {
                interpretation = 'Chronic Phase - blasts < 10%. Below accelerated phase threshold.';
                severity = 'LOW'; condition = 'Chronic Phase (< 10% blasts)';
            }
            return { type: 'CML (Chronic Myeloid Leukemia)', percentage: pct, interpretation, severity,
                condition, breakdown: { 'CML Cells': count }, recommendation: getDiseaseRecommendation('CML', severity) };
        };

        // CLL: Lymphocyte proportion - 40-50% Suspicious, 50-70% Typical, >70% Advanced
        const classifyCLL = (count) => {
            if (count === 0) return null;
            const pct = totalWBC > 0 ? (count / totalWBC) * 100 : 0;
            let interpretation, severity, condition;
            if (pct > 70) {
                interpretation = 'Advanced/Untreated CLL - > 70% abnormal lymphocytes. High CLL classification threshold reached.';
                severity = 'HIGH'; condition = 'Advanced/Untreated CLL (> 70%)';
            } else if (pct >= 50) {
                interpretation = 'Typical CLL - 50-70% abnormal lymphocytes. Moderate CLL classification threshold reached.';
                severity = 'MODERATE'; condition = 'Typical CLL (50-70%)';
            } else if (pct >= 40) {
                interpretation = 'Suspicious Lymphocytosis - 40-50% abnormal lymphocytes. Above monitoring threshold.';
                severity = 'LOW'; condition = 'Suspicious Lymphocytosis (40-50%)';
            } else {
                interpretation = 'Abnormal lymphocytes below suspicious threshold (< 40%).';
                severity = 'BELOW_THRESHOLD'; condition = `Below suspicious threshold (${pct.toFixed(1)}%)`;
            }
            return { type: 'CLL (Chronic Lymphocytic Leukemia)', percentage: pct, interpretation, severity,
                condition, breakdown: { 'CLL Cells': count }, recommendation: getDiseaseRecommendation('CLL', severity) };
        };

        const amlFinding = classifyAML(amlCount);
        if (amlFinding) diseaseFindings.push(amlFinding);

        const allFinding = classifyALL(allCount);
        if (allFinding) diseaseFindings.push(allFinding);

        const cmlFinding = classifyCML(cmlCount);
        if (cmlFinding) diseaseFindings.push(cmlFinding);

        const cllFinding = classifyCLL(cllCount);
        if (cllFinding) diseaseFindings.push(cllFinding);

        let sickleCount = 0;
        allProcessedImages.forEach(img => { if (img.sickleCount) sickleCount += img.sickleCount; });
        const sicklePercentage = counts.rbc > 0 ? (sickleCount / counts.rbc) * 100 : 0;
        let sickleInterpretation = 'Normal blood', sickleSeverity = 'NORMAL';
        if (sicklePercentage > 30) { sickleInterpretation = 'Severe Sickle Cell Anemia (HbSS)'; sickleSeverity = 'SEVERE'; }
        else if (sicklePercentage >= 10) { sickleInterpretation = 'Moderate Sickling'; sickleSeverity = 'MODERATE'; }
        else if (sicklePercentage >= 3) { sickleInterpretation = 'Mild Sickling (HbAS)'; sickleSeverity = 'MILD'; }
        else if (sicklePercentage > 0) { sickleInterpretation = 'Normal blood (< 3%)'; }

        // Overall Normal vs Disease ratio interpretation
        const normalPct = totalWBC > 0 ? (normalWBCCount / totalWBC) * 100 : 100;
        let overallClassification = 'normal', overallInterpretation = 'Predominantly Normal WBCs';
        if (normalPct >= 95) { overallClassification = 'normal'; overallInterpretation = 'Predominantly Normal WBCs - no significant abnormalities classified'; }
        else if (normalPct >= 85) { overallClassification = 'low'; overallInterpretation = 'Mostly Normal - low proportion of abnormal WBC classifications detected'; }
        else if (normalPct >= 70) { overallClassification = 'moderate'; overallInterpretation = 'Notable Abnormal Classification - significant proportion of WBCs classified as abnormal'; }
        else { overallClassification = 'high'; overallInterpretation = 'High Abnormal Classification - majority of WBCs classified as abnormal'; }

        let patientStatus = 'Normal';
        const hasCritical = diseaseFindings.some(f => f.severity === 'HIGH');
        const hasAbnormal = diseaseFindings.some(f => f.severity === 'MODERATE' || f.severity === 'LOW');
        if (hasCritical || sicklePercentage > 30) patientStatus = 'Critical';
        else if (hasAbnormal || sicklePercentage >= 3) patientStatus = 'Abnormal';

        return {
            thresholdMet: true, totalWBC: counts.wbc, totalRBC: counts.rbc, totalPlatelets: counts.platelets,
            estimatedWBCCount, estimatedRBCCount, avgRBCPerField: averageRBCPerImage,
            wbcClassifications: allClassifications, rbcClassifications: allRBCClassifications,
            abnormalWBCs, diseaseFindings, classificationCounts: wbcTypeCounts,
            normalWBCCount, diseaseWBCCount,
            overallClassification: {
                level: overallClassification,
                interpretation: overallInterpretation,
                normalPercentage: normalPct,
                diseasePercentage: totalWBC > 0 ? (diseaseWBCCount / totalWBC) * 100 : 0
            },
            sickleCell: {
                count: sickleCount, totalRBC: counts.rbc, percentage: sicklePercentage, interpretation: sickleInterpretation, severity: sickleSeverity,
                recommendation: getSickleCellAnalysis(sickleSeverity).recommendation
            },
            patientStatus
        };
    }, []);

    // LIVE UPDATE: Ensure finalResults is always up-to-date with current analysis
    useEffect(() => {
        if (processedImages.length > 0) {
            const results = calculateFinalResults(
                aggregatedClassifications,
                processedImages,
                aggregatedCounts,
                aggregatedRBCClassifications
            );
            setFinalResults(results);
        }
    }, [processedImages, aggregatedClassifications, aggregatedCounts, aggregatedRBCClassifications, calculateFinalResults]);

    // Load initial session
    useEffect(() => {
        (async () => {
            try {
                await migrateFromLocalStorage();
                const session = await loadSession();
                if (session) {
                    if (session.processedImages) setProcessedImages(session.processedImages);
                    if (session.aggregatedCounts) setAggregatedCounts(session.aggregatedCounts);
                    if (session.aggregatedClassifications) setAggregatedClassifications(session.aggregatedClassifications);
                    if (session.aggregatedRBCClassifications) setAggregatedRBCClassifications(session.aggregatedRBCClassifications);
                    if (session.currentResults) setCurrentResults(session.currentResults);

                    if (session.patientData) {
                        setPatientName(session.patientData.name || '');
                        setPatientId(session.patientData.id || '');
                        setPatientAge(session.patientData.age || '');
                        setPatientGender(session.patientData.gender || 'Male');
                        setPatientPhone(session.patientData.phone || '');
                    }
                    if (session.isRegistered) setIsRegistered(true);

                    const isThresholdMet = session.thresholdMet === true || (session.processedImages && session.processedImages.length >= TARGET_IMAGE_COUNT);
                    setThresholdMet(isThresholdMet);

                    // Restore finalResults if available (the useEffect will recalculate if needed)
                    if (session.finalResults) {
                        setFinalResults(session.finalResults);
                    }

                    console.log('Session restored:', {
                        imagesCount: session.processedImages?.length || 0,
                        thresholdMet: isThresholdMet,
                        hasFinalResults: !!session.finalResults
                    });
                }
            } catch (error) {
                console.log('No valid session to restore:', error);
            }
        })();
    }, []);

    // Save Report Functionality
    const saveReport = () => {
        if (!finalResults) {
            alert("No analysis results to save.");
            return;
        }

        try {
            // Create a meaningful report ID using MRN and timestamp
            const reportId = patientId ? `${patientId}_${Date.now()}` : `UNKNOWN_${Date.now()}`;

            const newReport = {
                id: reportId,
                timestamp: new Date().toLocaleString(),
                patientData: {
                    name: patientName,
                    id: patientId,
                    age: patientAge,
                    gender: patientGender,
                    phone: patientPhone
                },
                summary: {
                    totalCells: (finalResults.totalWBC + finalResults.totalRBC + finalResults.totalPlatelets),
                    wbcCount: finalResults.totalWBC,
                    rbcCount: finalResults.totalRBC,
                    plateletCount: finalResults.totalPlatelets,
                    sickleCount: finalResults.sickleCell?.count || 0,
                    estimatedWBCCount: finalResults.estimatedWBCCount,
                    estimatedRBCCount: finalResults.estimatedRBCCount,
                    imagesAnalyzed: processedImages.length
                },
                data: {
                    diseaseFindings: finalResults.diseaseFindings,
                    abnormalWBCs: finalResults.abnormalWBCs ? finalResults.abnormalWBCs.length : 0,
                    classificationCounts: finalResults.classificationCounts,
                    normalWBCCount: finalResults.normalWBCCount,
                    diseaseWBCCount: finalResults.diseaseWBCCount,
                    sickleCount: finalResults.sickleCell?.count || 0,
                    sickleCell: finalResults.sickleCell
                },
                sessionData: {
                    analysisComplete: true,
                    wbcClassificationCount: finalResults.totalWBC,
                    totalImagesAnalyzed: processedImages.length
                }
            };

            const savedReports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
            savedReports.unshift(newReport); // Add to top
            localStorage.setItem('hemalyzer_reports', JSON.stringify(savedReports));

            alert("Report saved successfully!");
        } catch (error) {
            console.error("Failed to save report:", error);
            alert("Failed to save report. Please try again.");
        }
    };

    // Handle Reset - Clears all analysis state to start a new analysis
    const handleReset = useCallback(async () => {
        try {
            await clearSession();
        } catch (error) {
            console.error('Failed to clear session:', error);
        }
        // Reset all state
        setPatientName('');
        setPatientId('');
        setPatientAge('');
        setPatientGender('Male');
        setPatientPhone('');
        setIsRegistered(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        setLoading(false);
        setError(null);
        setAnalysisProgress({ stage: '', percentage: 0, message: '' });
        setProcessedImages([]);
        setAggregatedCounts({ wbc: 0, rbc: 0, platelets: 0 });
        setAggregatedClassifications([]);
        setAggregatedRBCClassifications([]);
        setCurrentResults(null);
        setShowCurrentResults(true);
        setThresholdMet(false);
        setFinalResults(null);
        setBulkFiles([]);
        setBulkProgress({ current: 0, total: 0 });
        setImageProgress(0);
        setIsBulkProcessing(false);
    }, []);

    // Client-side image validation helper
    const validateImageFile = useCallback((file) => {
        return new Promise((resolve, reject) => {
            // Check file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                reject('Invalid file type. Please upload JPG or PNG images only.');
                return;
            }

            // Check file size (max 20MB)
            const maxSize = 20 * 1024 * 1024;
            if (file.size > maxSize) {
                reject('File too large. Maximum size is 20MB.');
                return;
            }

            // Load image to check dimensions and basic properties
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);

                // Check minimum dimensions (blood smear images should be reasonably sized)
                const minDimension = 200;
                if (img.width < minDimension || img.height < minDimension) {
                    reject(`Image too small. Minimum dimensions: ${minDimension}x${minDimension} pixels.`);
                    return;
                }

                // Check aspect ratio (blood smear images are typically square-ish or 4:3)
                const aspectRatio = img.width / img.height;
                if (aspectRatio > 3 || aspectRatio < 0.33) {
                    reject('Unusual aspect ratio. Blood smear images should not be extremely wide or tall.');
                    return;
                }

                resolve({ width: img.width, height: img.height });
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject('Failed to load image. The file may be corrupted.');
            };

            img.src = objectUrl;
        });
    }, []);

    // Handle File Change - Process selected file for preview with validation
    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Validate image before showing preview
                await validateImageFile(file);

                setSelectedFile(file);
                setPreviewUrl(URL.createObjectURL(file));
                setError(null);
            } catch (validationError) {
                setError(validationError);
                setSelectedFile(null);
                setPreviewUrl(null);
                // Reset the file input
                e.target.value = '';
            }
        }
    }, [validateImageFile]);

    // Handle Patient Registration
    const handleRegistration = useCallback((e) => {
        if (e) e.preventDefault();
        if (patientName.trim() && patientId.trim()) {
            setIsRegistered(true);
        }
    }, [patientName, patientId]);

    // Handle Bulk File Change with validation
    const handleBulkFileChange = useCallback(async (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];
        const errors = [];

        for (const file of files) {
            try {
                await validateImageFile(file);
                validFiles.push(file);
            } catch (err) {
                errors.push(`${file.name}: ${err}`);
            }
        }

        if (errors.length > 0) {
            setError(`Some files were rejected:\n${errors.join('\n')}`);
        } else {
            setError(null);
        }

        setBulkFiles(validFiles);
    }, [validateImageFile]);

    // Handle Single Image Analysis
    const handleAnalyze = useCallback(async () => {
        if (!selectedFile) {
            setError('Please select a file first');
            return;
        }

        if (processedImages.length >= TARGET_IMAGE_COUNT) {
            setError('Analysis threshold already met. Please start a new analysis.');
            return;
        }

        setLoading(true);
        setError(null);
        setAnalysisProgress({ stage: 'Uploading', percentage: 10, message: 'Uploading image...' });

        try {
            const formData = new FormData();
            formData.append('image', selectedFile);

            setAnalysisProgress({ stage: 'Processing', percentage: 30, message: 'Processing image...' });

            // Create abort controller for this request
            abortControllerRef.current = new AbortController();
            cancelledRef.current = false;

            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: formData,
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            setAnalysisProgress({ stage: 'Classifying', percentage: 70, message: 'Classifying cells...' });

            const data = await response.json();

            // Check if the image was rejected (not a valid blood smear)
            if (data.success === false) {
                setError(data.error || 'Image validation failed. Please ensure you upload a valid 100x oil immersion blood smear.');
                setLoading(false);
                setAnalysisProgress({ stage: '', percentage: 0, message: '' });
                return;
            }

            setAnalysisProgress({ stage: 'Complete', percentage: 100, message: 'Analysis complete!' });

            // Update current results
            setCurrentResults(data);

            // Update aggregated data
            const newProcessedImages = [...processedImages, {
                id: Date.now(),
                filename: selectedFile.name,
                fileName: selectedFile.name,  // For duplicate checking compatibility
                fileSize: selectedFile.size,  // For duplicate checking
                lastModified: selectedFile.lastModified,  // For duplicate checking
                preview: previewUrl,
                annotatedImage: data.annotated_image,
                results: data,
                wbcCount: data.wbc_count || data.stage1_detection?.counts?.WBC || 0,
                rbcCount: data.rbc_count || data.stage1_detection?.counts?.RBC || 0,
                plateletCount: data.platelet_count || data.stage1_detection?.counts?.Platelets || 0,
                sickleCount: data.rbc_classifications?.filter(r => r.is_sickle_cell || r.is_abnormal)?.length || 0,
                wbcClassifications: data.wbc_classifications || data.stage2_classification || []
            }];
            setProcessedImages(newProcessedImages);

            const newCounts = {
                wbc: aggregatedCounts.wbc + (data.wbc_count || data.stage1_detection?.counts?.WBC || 0),
                rbc: aggregatedCounts.rbc + (data.rbc_count || data.stage1_detection?.counts?.RBC || 0),
                platelets: aggregatedCounts.platelets + (data.platelet_count || data.stage1_detection?.counts?.Platelets || 0)
            };
            setAggregatedCounts(newCounts);

            if (data.wbc_classifications || data.stage2_classification) {
                setAggregatedClassifications(prev => [...prev, ...(data.wbc_classifications || data.stage2_classification || [])]);
            }
            if (data.rbc_classifications) {
                setAggregatedRBCClassifications(prev => [...prev, ...data.rbc_classifications]);
            }

            // Check threshold
            if (newProcessedImages.length >= TARGET_IMAGE_COUNT) {
                setThresholdMet(true);
            }

            // Clear file input for next upload
            setSelectedFile(null);
            setPreviewUrl(null);

            // Calculate final results for this save
            const updatedClassifications = [...aggregatedClassifications, ...(data.wbc_classifications || data.stage2_classification || [])];
            const updatedRBCClassifications = [...aggregatedRBCClassifications, ...(data.rbc_classifications || [])];
            const computedFinalResults = calculateFinalResults(updatedClassifications, newProcessedImages, newCounts, updatedRBCClassifications);

            // Save session
            await saveSession({
                processedImages: newProcessedImages,
                aggregatedCounts: newCounts,
                aggregatedClassifications: updatedClassifications,
                aggregatedRBCClassifications: updatedRBCClassifications,
                currentResults: data,
                finalResults: computedFinalResults,
                patientData: { name: patientName, id: patientId, age: patientAge, gender: patientGender, phone: patientPhone },
                isRegistered,
                thresholdMet: newProcessedImages.length >= TARGET_IMAGE_COUNT,
                timestamp: Date.now()
            });

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Analysis cancelled by user');
                return;
            }
            console.error('Analysis error:', error);
            setError(error.message || 'Failed to analyze image');
        } finally {
            abortControllerRef.current = null;
            setLoading(false);
            setAnalysisProgress({ stage: '', percentage: 0, message: '' });
        }
    }, [selectedFile, previewUrl, processedImages, aggregatedCounts, aggregatedClassifications, aggregatedRBCClassifications, patientName, patientId, patientAge, patientGender, patientPhone, isRegistered, calculateFinalResults]);

    // Handle Bulk Upload
    const handleBulkUpload = useCallback(async () => {
        if (!bulkFiles || bulkFiles.length === 0) {
            setError('Please select files first');
            return;
        }

        const remainingSlots = TARGET_IMAGE_COUNT - processedImages.length;
        if (remainingSlots <= 0) {
            setError('Analysis threshold already met. Please start a new analysis.');
            return;
        }

        const filesToProcess = bulkFiles.slice(0, remainingSlots);
        setIsBulkProcessing(true);
        setBulkProgress({ current: 0, total: filesToProcess.length });
        setError(null);

        // Create abort controller for bulk processing
        abortControllerRef.current = new AbortController();
        cancelledRef.current = false;

        let newProcessedImages = [...processedImages];
        let newCounts = { ...aggregatedCounts };
        let newClassifications = [...aggregatedClassifications];
        let newRBCClassifications = [...aggregatedRBCClassifications];

        for (let i = 0; i < filesToProcess.length; i++) {
            // Check if cancelled before processing next image
            if (cancelledRef.current) {
                console.log('Bulk processing cancelled by user');
                break;
            }

            const file = filesToProcess[i];
            setBulkProgress({ current: i + 1, total: filesToProcess.length });

            // Per-image progress: Upload phase (10%)
            setAnalysisProgress({
                stage: 'Uploading',
                percentage: 10,
                message: `Image ${i + 1}/${filesToProcess.length}: Uploading ${file.name}...`
            });

            try {
                const formData = new FormData();
                formData.append('image', file);

                // Per-image progress: Detection phase (50%)
                setAnalysisProgress({
                    stage: 'Processing',
                    percentage: 50,
                    message: `Image ${i + 1}/${filesToProcess.length}: Detecting cells...`
                });

                const response = await fetch(`${API_URL}/api/analyze`, {
                    method: 'POST',
                    headers: getApiHeaders(),
                    body: formData,
                    signal: abortControllerRef.current?.signal
                });

                if (!response.ok) {
                    console.error(`Failed to process ${file.name}`);
                    continue;
                }

                // Per-image progress: Classification phase (80%)
                setAnalysisProgress({
                    stage: 'Classifying',
                    percentage: 80,
                    message: `Image ${i + 1}/${filesToProcess.length}: Classifying cells...`
                });

                const data = await response.json();

                // Check if the image was rejected (not a valid blood smear)
                if (data.success === false) {
                    console.warn(`Skipped ${file.name}: ${data.error || 'Invalid blood smear image'}`);
                    continue;
                }

                // Per-image progress: Complete (100%)
                setAnalysisProgress({
                    stage: 'Complete',
                    percentage: 100,
                    message: `Image ${i + 1}/${filesToProcess.length}: Complete!`
                });

                const newImage = {
                    id: Date.now() + i,
                    filename: file.name,
                    fileName: file.name,  // For duplicate checking compatibility
                    fileSize: file.size,  // For duplicate checking
                    lastModified: file.lastModified,  // For duplicate checking
                    preview: URL.createObjectURL(file),
                    annotatedImage: data.annotated_image,
                    results: data,
                    wbcCount: data.wbc_count || data.stage1_detection?.counts?.WBC || 0,
                    rbcCount: data.rbc_count || data.stage1_detection?.counts?.RBC || 0,
                    plateletCount: data.platelet_count || data.stage1_detection?.counts?.Platelets || 0,
                    sickleCount: data.rbc_classifications?.filter(r => r.is_sickle_cell || r.is_abnormal)?.length || 0,
                    wbcClassifications: data.wbc_classifications || data.stage2_classification || []
                };

                newProcessedImages.push(newImage);

                newCounts = {
                    wbc: newCounts.wbc + (data.wbc_count || data.stage1_detection?.counts?.WBC || 0),
                    rbc: newCounts.rbc + (data.rbc_count || data.stage1_detection?.counts?.RBC || 0),
                    platelets: newCounts.platelets + (data.platelet_count || data.stage1_detection?.counts?.Platelets || 0)
                };

                if (data.wbc_classifications || data.stage2_classification) {
                    newClassifications = [...newClassifications, ...(data.wbc_classifications || data.stage2_classification || [])];
                }
                if (data.rbc_classifications) {
                    newRBCClassifications = [...newRBCClassifications, ...data.rbc_classifications];
                }

                // Update state progressively after each image for real-time UI updates
                setProcessedImages([...newProcessedImages]);
                setAggregatedCounts({ ...newCounts });
                setAggregatedClassifications([...newClassifications]);
                setAggregatedRBCClassifications([...newRBCClassifications]);
                setCurrentResults(data);

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('Bulk processing cancelled by user');
                    break;
                }
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        abortControllerRef.current = null;

        // Final state update (redundant but ensures consistency)
        setProcessedImages(newProcessedImages);
        setAggregatedCounts(newCounts);
        setAggregatedClassifications(newClassifications);
        setAggregatedRBCClassifications(newRBCClassifications);

        if (newProcessedImages.length >= TARGET_IMAGE_COUNT) {
            setThresholdMet(true);
        }

        // Calculate final results for this save
        const computedFinalResults = calculateFinalResults(newClassifications, newProcessedImages, newCounts, newRBCClassifications);

        // Save session
        await saveSession({
            processedImages: newProcessedImages,
            aggregatedCounts: newCounts,
            aggregatedClassifications: newClassifications,
            aggregatedRBCClassifications: newRBCClassifications,
            currentResults: newProcessedImages[newProcessedImages.length - 1]?.results || null,
            finalResults: computedFinalResults,
            patientData: { name: patientName, id: patientId, age: patientAge, gender: patientGender, phone: patientPhone },
            isRegistered,
            thresholdMet: newProcessedImages.length >= TARGET_IMAGE_COUNT,
            timestamp: Date.now()
        });

        setBulkFiles([]);
        setIsBulkProcessing(false);
        setBulkProgress({ current: 0, total: 0 });
        setAnalysisProgress({ stage: '', percentage: 0, message: '' });

    }, [bulkFiles, processedImages, aggregatedCounts, aggregatedClassifications, aggregatedRBCClassifications, patientName, patientId, patientAge, patientGender, patientPhone, isRegistered, calculateFinalResults]);

    const value = {
        patientName, setPatientName,
        patientId, setPatientId,
        patientAge, setPatientAge,
        patientGender, setPatientGender,
        patientPhone, setPatientPhone,
        isRegistered, setIsRegistered,
        selectedFile, setSelectedFile,
        previewUrl, setPreviewUrl,
        loading, setLoading,
        error, setError,
        analysisProgress, setAnalysisProgress,
        processedImages, setProcessedImages,
        aggregatedCounts, setAggregatedCounts,
        aggregatedClassifications, setAggregatedClassifications,
        aggregatedRBCClassifications, setAggregatedRBCClassifications,
        currentResults, setCurrentResults,
        showCurrentResults, setShowCurrentResults,
        thresholdMet, setThresholdMet,
        finalResults, setFinalResults,
        bulkFiles, setBulkFiles,
        bulkProgress, setBulkProgress,
        imageProgress, setImageProgress,
        isBulkProcessing, setIsBulkProcessing,
        calculateFinalResults,
        cancelAnalysis,
        saveReport,
        handleReset,
        handleFileChange,
        handleAnalyze,
        handleBulkFileChange,
        handleBulkUpload,
        handleRegistration,
        TARGET_IMAGE_COUNT
    };

    return (
        <AnalysisContext.Provider value={value}>
            {children}
        </AnalysisContext.Provider>
    );
};

export const useAnalysis = () => {
    const context = useContext(AnalysisContext);
    if (!context) {
        throw new Error('useAnalysis must be used within an AnalysisProvider');
    }
    return context;
};
