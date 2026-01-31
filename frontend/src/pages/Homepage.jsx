import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";
import { FinalResults } from "../components/FinalResults.jsx";
import { saveSession, loadSession, clearSession, migrateFromLocalStorage } from "../utils/sessionStorage.js"; // Check this import path
import { RegistrationForm } from "../components/homepage/RegistrationForm.jsx";
import { UploadSection } from "../components/homepage/UploadSection.jsx";
import { AnalysisResults } from "../components/homepage/AnalysisResults.jsx";
import { ClassificationsModal } from "../components/homepage/ClassificationsModal.jsx";
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

const RBC_MULTIPLIER = 200000;
const WBC_MULTIPLIER = 2000;
const NUM_FIELDS = 10;

const Homepage = () => {
    const navigate = useNavigate();
    const location = useLocation();

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

    // Calculate aggregated results when threshold is met
    const calculateFinalResults = useCallback((allClassifications, allProcessedImages, counts, allRBCClassifications = []) => {
        // Count WBC types from ConvNeXt classifications
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

        // Disease counts - track by cell type for proper breakdown
        let cmlCount = 0;
        let cllCount = 0;
        let allCount = 0;
        let amlCount = 0;

        // CML granulocyte breakdown
        const cmlGranulocyteBreakdown = {
            basophil: 0,
            eosinophil: 0,
            myeloblast: 0,
            neutrophil: 0
        };

        // Blast cell type breakdown for AML/ALL
        const blastBreakdown = {
            lymphoblast: 0,  // B_Lymphoblast or Lymphoblast -> indicates ALL
            myeloblast: 0    // Myeloblast -> indicates AML
        };

        // Track abnormal WBCs
        const abnormalWBCs = [];

        allClassifications.forEach(cls => {
            const classification = cls.classification || '';
            wbcTypeCounts[classification] = (wbcTypeCounts[classification] || 0) + 1;

            const classificationStr = (cls.classification || '').toLowerCase();

            // Robust detection logic
            const hasCML = classificationStr.includes('cml');
            const hasCLL = classificationStr.includes('cll');
            const hasAML = classificationStr.includes('aml');
            const hasALL = classificationStr.includes('all');

            const isNeutrophil = classificationStr.includes('neutrophil');
            const isLymphocyte = classificationStr.includes('lymphocyte');
            const isMonocyte = classificationStr.includes('monocyte');
            const isEosinophil = classificationStr.includes('eosinophil') || classificationStr.includes('eosonophil');
            const isBasophil = classificationStr.includes('basophil');
            const isMyeloblast = classificationStr.includes('myeloblast');
            const isLymphoblast = classificationStr.includes('lymphoblast') || classificationStr.includes('b_lymphoblast');
            const isMyelocyte = classificationStr.includes('myelocyte');
            const isMetamyelocyte = classificationStr.includes('metamyelocyte');
            const isPromyelocyte = classificationStr.includes('promyelocyte');

            if (isNeutrophil || isMyelocyte || isMetamyelocyte || isPromyelocyte || (isMyeloblast && !hasAML)) {
                differentialCounts['Neutrophil']++;
            } else if (isLymphocyte || isLymphoblast) {
                differentialCounts['Lymphocyte']++;
            } else if (isMonocyte) {
                differentialCounts['Monocyte']++;
            } else if (isEosinophil) {
                differentialCounts['Eosinophil']++;
            } else if (isBasophil) {
                differentialCounts['Basophil']++;
            }

            if (!classificationStr.includes('normal') && cls.classification) {
                abnormalWBCs.push(cls);
            }

            // Disease Counting
            if (hasCML || isMyelocyte || isMetamyelocyte || isPromyelocyte) {
                cmlCount++;
                if (isBasophil) cmlGranulocyteBreakdown.basophil++;
                else if (isEosinophil) cmlGranulocyteBreakdown.eosinophil++;
                else if (isMyeloblast || isMyelocyte || isMetamyelocyte || isPromyelocyte) cmlGranulocyteBreakdown.myeloblast++;
                else if (isNeutrophil) cmlGranulocyteBreakdown.neutrophil++;
            }

            if (hasCLL) cllCount++;

            if (hasALL || isLymphoblast) {
                allCount++;
                blastBreakdown.lymphoblast++;
            }

            if (hasAML || isMyeloblast) {
                amlCount++;
                blastBreakdown.myeloblast++;
            }
        });

        const totalImagesProcessed = allProcessedImages.length;
        const averageRBCPerImage = totalImagesProcessed > 0 ? counts.rbc / totalImagesProcessed : 0;
        const estimatedRBCCount = Math.round((averageRBCPerImage / 10) * RBC_MULTIPLIER);
        const estimatedWBCCount = Math.round((counts.wbc / NUM_FIELDS) * WBC_MULTIPLIER);

        const totalWBC = counts.wbc;
        const wbcDifferential = {};

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

        // Disease percentages
        const blastCount = amlCount + allCount;
        const blastPercentage = totalWBC > 0 ? (blastCount / totalWBC) * 100 : 0;
        const cmlPercentage = totalWBC > 0 ? (cmlCount / totalWBC) * 100 : 0;
        const cllPercentage = totalWBC > 0 ? (cllCount / totalWBC) * 100 : 0;

        const diseaseFindings = [];

        // AML (Acute Myeloblastic Leukemia)
        if (amlCount > 0) {
            const amlPercentage = totalWBC > 0 ? (amlCount / totalWBC) * 100 : 0;
            let interpretation = '';
            let severity = 'INFO';

            if (amlPercentage >= 20) {
                interpretation = 'Diagnostic level for Acute Myeloid Leukemia (AML) - Myeloblasts predominate';
                severity = 'HIGH';
            } else if (amlPercentage >= 10) {
                interpretation = 'Suspicious / Pre-leukemic (AML) - High myeloblast count';
                severity = 'MODERATE';
            } else {
                interpretation = 'Myeloblasts detected - Clinical correlation advised';
                severity = 'INFO';
            }

            diseaseFindings.push({
                type: 'AML (Acute Myeloblastic Leukemia)',
                percentage: amlPercentage,
                interpretation,
                severity,
                condition: 'Acute Myeloid Leukemia',
                breakdown: {
                    "AML:Myeloblast": blastBreakdown.myeloblast
                }
            });
        }

        // ALL (Acute Lymphoblastic Leukemia)
        if (allCount > 0) {
            const allPercentage = totalWBC > 0 ? (allCount / totalWBC) * 100 : 0;
            let interpretation = '';
            let severity = 'INFO';

            if (allPercentage >= 20) {
                interpretation = 'Diagnostic level for Acute Lymphoblastic Leukemia (ALL) - Lymphoblasts predominate';
                severity = 'HIGH';
            } else if (allPercentage >= 10) {
                interpretation = 'Suspicious / Pre-leukemic (ALL) - High lymphoblast count';
                severity = 'MODERATE';
            } else {
                interpretation = 'Lymphoblasts detected - Clinical correlation advised';
                severity = 'INFO';
            }

            diseaseFindings.push({
                type: 'ALL (Acute Lymphoblastic Leukemia)',
                percentage: allPercentage,
                interpretation,
                severity,
                condition: 'Acute Lymphoblastic Leukemia',
                breakdown: {
                    "ALL:B_Lymphoblast": blastBreakdown.lymphoblast
                }
            });
        }

        // CML (Chronic Myeloid Leukemia)
        {
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
            } else if (cmlCount > 0) {
                interpretation = 'CML-marked cells detected but below threshold levels';
                condition = 'Monitor for CML';
                severity = 'INFO';
            } else {
                interpretation = 'No CML-marked granulocytes detected - Normal differential';
                condition = 'Normal';
                severity = 'INFO';
            }

            diseaseFindings.push({
                type: 'CML (Chronic Myeloid Leukemia)',
                percentage: cmlPercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    "CML:Basophil": cmlGranulocyteBreakdown.basophil,
                    "CML:Eosonphil": cmlGranulocyteBreakdown.eosinophil,
                    "CML:Myeloblast": cmlGranulocyteBreakdown.myeloblast,
                    "CML:Neutrophils": cmlGranulocyteBreakdown.neutrophil
                }
            });
        }

        // CLL (Chronic Lymphocytic Leukemia)
        {
            let interpretation = '';
            let severity = 'INFO';
            let condition = 'Normal';

            if (cllPercentage > 80) {
                interpretation = 'Advanced / Progressive CLL - lymphocytes dominate smear';
                condition = 'Chronic Lymphocytic Leukemia (Advanced/Progressive)';
                severity = 'HIGH';
            } else if (cllPercentage >= 66) {
                interpretation = 'Typical Chronic Lymphocytic Leukemia (CLL)';
                condition = 'Chronic Lymphocytic Leukemia (CLL)';
                severity = 'HIGH';
            } else if (cllPercentage >= 51) {
                interpretation = 'Suspicious for Early / Smoldering CLL';
                condition = 'Suspicious for Early CLL';
                severity = 'MODERATE';
            } else if (cllPercentage >= 35) {
                interpretation = 'Reactive / Secondary Lymphocytosis - may occur with viral infections';
                condition = 'Reactive Lymphocytosis';
                severity = 'LOW';
            } else if (cllCount > 0) {
                interpretation = 'CLL-marked cells detected but below threshold levels';
                condition = 'Monitor for CLL';
                severity = 'INFO';
            } else {
                interpretation = 'No CLL-marked lymphocytes detected - Normal lymphocyte count';
                condition = 'Normal';
                severity = 'INFO';
            }

            diseaseFindings.push({
                type: 'CLL (Chronic Lymphocytic Leukemia)',
                percentage: cllPercentage,
                interpretation,
                severity,
                condition,
                breakdown: {
                    "CLL:Lymphocytes": cllCount
                }
            });
        }

        // Sickle Cell
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
            estimatedWBCCount,
            estimatedRBCCount,
            avgRBCPerField: averageRBCPerImage,
            wbcClassifications: allClassifications,
            rbcClassifications: allRBCClassifications,
            abnormalWBCs,
            wbcDifferential,
            diseaseFindings,
            classificationCounts: wbcTypeCounts,
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

    // Restore state
    useEffect(() => {
        if (location.state?.results) {
            setCurrentResults(location.state.results);
            setPreviewUrl(location.state.previewUrl);
        }
        if (location.state?.sessionState) {
            const session = location.state.sessionState;
            if (session.processedImages) setProcessedImages(session.processedImages);
            if (session.aggregatedCounts) setAggregatedCounts(session.aggregatedCounts);
            if (session.aggregatedClassifications) setAggregatedClassifications(session.aggregatedClassifications);
            if (session.aggregatedRBCClassifications) setAggregatedRBCClassifications(session.aggregatedRBCClassifications);
            if (session.thresholdMet !== undefined) setThresholdMet(session.thresholdMet);
            if (session.finalResults) setFinalResults(session.finalResults);
        }
        else {
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
                        if (session.isRegistered) {
                            setIsRegistered(true);
                        }

                        const isThresholdMet = session.thresholdMet === true ||
                            (session.processedImages && session.processedImages.length >= TARGET_IMAGE_COUNT);

                        if (isThresholdMet) {
                            setThresholdMet(true);
                            if (session.finalResults) {
                                setFinalResults(session.finalResults);
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
    }, [location.state]);

    // Safety sync
    useEffect(() => {
        const shouldHaveThreshold = processedImages.length >= TARGET_IMAGE_COUNT;
        if (shouldHaveThreshold && !thresholdMet) {
            setThresholdMet(true);
        }
        if (shouldHaveThreshold && thresholdMet && !finalResults && aggregatedClassifications.length > 0) {
            const recalculatedResults = calculateFinalResults(
                aggregatedClassifications,
                processedImages,
                aggregatedCounts,
                aggregatedRBCClassifications
            );
            setFinalResults(recalculatedResults);
        }
    }, [processedImages, thresholdMet, finalResults, aggregatedClassifications, aggregatedCounts, aggregatedRBCClassifications, calculateFinalResults]);

    // Client-side image validation helper
    const validateImageContent = (file) => {
        return new Promise((resolve, reject) => {
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (file.size > maxSize) {
                resolve({
                    valid: false,
                    error: `File size too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is 2MB per image.`
                });
                return;
            }

            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                const width = img.naturalWidth;
                const height = img.naturalHeight;

                if (width < 400 || height < 400) {
                    resolve({
                        valid: false,
                        error: 'Image resolution too low. Microscope images must be high definition (min 400x400).'
                    });
                    return;
                }

                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 50;
                    canvas.height = 50;
                    ctx.drawImage(img, 0, 0, 50, 50);

                    const imageData = ctx.getImageData(0, 0, 50, 50);
                    const data = imageData.data;
                    let rTotal = 0, gTotal = 0, bTotal = 0;
                    const pixelCount = data.length / 4;

                    for (let i = 0; i < data.length; i += 4) {
                        rTotal += data[i];
                        gTotal += data[i + 1];
                        bTotal += data[i + 2];
                    }
                    const rMean = rTotal / pixelCount;
                    const gMean = gTotal / pixelCount;
                    const bMean = bTotal / pixelCount;

                    let varianceSum = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        varianceSum += Math.abs(data[i] - rMean) + Math.abs(data[i + 1] - gMean) + Math.abs(data[i + 2] - bMean);
                    }
                    const avgVariance = varianceSum / pixelCount;

                    if (avgVariance < 15) {
                        resolve({
                            valid: false,
                            error: 'Image appears to be blank or a solid color. Please upload a valid blood smear.'
                        });
                        return;
                    }

                    let stainedPixelCount = 0;
                    const stainThreshold = pixelCount * 0.02;

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        if ((r > g + 15) || (b > g + 15)) {
                            stainedPixelCount++;
                        }
                    }

                    if (stainedPixelCount < stainThreshold) {
                        resolve({
                            valid: false,
                            error: 'Image rejected: No characteristic cell stain colors detected.\n\n' +
                                'Please ensure you are uploading a standard blood smear (Wright-Giemsa stain).\n' +
                                'Logos, diagrams, or non-medical images will be rejected.'
                        });
                        return;
                    }
                    resolve({ valid: true });

                } catch (e) {
                    console.error("Validation error:", e);
                    resolve({ valid: true });
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ valid: false, error: 'Failed to load image file. It may be corrupted.' });
            };
            img.src = url;
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedExtensions = /\.(jpg|jpeg|png)$/i;
            if (!allowedExtensions.test(file.name)) {
                alert('Invalid file format. Please upload a JPG or PNG image.');
                e.target.value = '';
                return;
            }

            const validation = await validateImageContent(file);
            if (!validation.valid) {
                alert(`Invalid Image: ${validation.error}`);
                e.target.value = '';
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setCurrentResults(null);
            setError(null);
            setShowCurrentResults(true);
        }
    };

    // Analyze Single Image
    const handleAnalyze = async () => {
        if (!selectedFile) {
            setError('Please select an image first');
            return;
        }

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
                const wbcCount = data.stage1_detection?.counts?.WBC || 0;
                const rbcCount = data.stage1_detection?.counts?.RBC || 0;
                const plateletCount = data.stage1_detection?.counts?.Platelets || 0;
                const sickleCount = data.summary?.sickle_cell_count || 0;

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

                // Update state
                const newProcessedImages = [...processedImages, processedImage];
                setProcessedImages(newProcessedImages);

                const newCounts = {
                    wbc: aggregatedCounts.wbc + wbcCount,
                    rbc: aggregatedCounts.rbc + rbcCount,
                    platelets: aggregatedCounts.platelets + plateletCount
                };
                setAggregatedCounts(newCounts);

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
                const newClassifications = [...aggregatedClassifications, ...classificationsWithImages];
                setAggregatedClassifications(newClassifications);

                const rbcCells = (data.cropped_cells || []).filter(cell => cell.cell_type === 'RBC');
                const newRBCClassifications = [...aggregatedRBCClassifications, ...rbcCells];
                setAggregatedRBCClassifications(newRBCClassifications);

                setCurrentResults(data);

                if (newProcessedImages.length >= TARGET_IMAGE_COUNT) {
                    setThresholdMet(true);
                    const finalCalc = calculateFinalResults(newClassifications, newProcessedImages, newCounts, newRBCClassifications);
                    setFinalResults(finalCalc);
                }

                // Save session
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
                saveSession(sessionState).catch(err => {
                    console.error('Failed to save session:', err);
                    setError('Warning: Session could not be saved for page reload.');
                });

                setSelectedFile(null);
                const fileInput = document.getElementById('pbs-upload'); // Check ID usage in new component if needed, or rely on React state
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

    // Reset
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
        setBulkFiles([]);
        setBulkProgress({ current: 0, total: 0 });
        setImageProgress(0);
        setIsBulkProcessing(false);

        try {
            await clearSession();
            localStorage.removeItem('hemalyzer_session_fallback');
            localStorage.removeItem('hemalyzer_current_session');
        } catch (err) {
            console.error('Failed to clear session:', err);
        }
    };

    // Bulk File Change
    const handleBulkFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const allowedExtensions = /\.(jpg|jpeg|png)$/i;
            const invalidExtFiles = files.filter(file => !allowedExtensions.test(file.name));

            if (invalidExtFiles.length > 0) {
                alert(`Invalid file format detected in ${invalidExtFiles.length} file(s). Please upload only JPG or PNG images.`);
                e.target.value = '';
                return;
            }

            const remaining = TARGET_IMAGE_COUNT - processedImages.length;
            const maxAllowed = Math.min(remaining, 10);

            if (files.length > maxAllowed) {
                setError(`Only ${maxAllowed} more image${maxAllowed !== 1 ? 's' : ''} needed. Selected first ${maxAllowed} of ${files.length} images.`);
            } else {
                setError(null);
            }

            const filesToProcess = files.slice(0, maxAllowed);
            const validFiles = [];
            const invalidContentFiles = [];

            for (const file of filesToProcess) {
                const validation = await validateImageContent(file);
                if (validation.valid) {
                    validFiles.push(file);
                } else {
                    invalidContentFiles.push({ name: file.name, error: validation.error });
                }
            }

            if (invalidContentFiles.length > 0) {
                const errorMsg = `Skipped ${invalidContentFiles.length} invalid images:\n` +
                    invalidContentFiles.map(f => `- ${f.name}: ${f.error}`).join('\n');
                alert(errorMsg);
                if (validFiles.length === 0) {
                    e.target.value = '';
                    return;
                }
            }

            setBulkFiles(validFiles);
        }
    };

    const processSingleImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('conf_threshold', '0.2');
        formData.append('iou_threshold', '0.2');

        const response = await fetch(`${API_URL}/api/analyze`, {
            method: 'POST',
            body: formData,
        });
        return await response.json();
    };

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
                setImageProgress(0);
                setBulkProgress({ current: i, total: bulkFiles.length }); // Should be i+1? No, i completed? UI says processed.
                setAnalysisProgress({
                    stage: 'bulk',
                    percentage: 0,
                    message: `Processing image ${i + 1} of ${bulkFiles.length}: ${file.name}`
                });

                let simulatedProgress = 0;
                const progressInterval = setInterval(() => {
                    simulatedProgress += Math.random() * 15 + 5;
                    if (simulatedProgress > 90) simulatedProgress = 90;
                    setImageProgress(Math.round(simulatedProgress));
                    setAnalysisProgress(prev => ({
                        ...prev,
                        percentage: Math.round(simulatedProgress)
                    }));
                }, 300);

                const data = await processSingleImage(file);

                clearInterval(progressInterval);
                setImageProgress(100);
                setAnalysisProgress(prev => ({ ...prev, percentage: 100 }));
                await new Promise(resolve => setTimeout(resolve, 200));

                if (data.success) {
                    const wbcCount = data.stage1_detection?.counts?.WBC || 0;
                    const rbcCount = data.stage1_detection?.counts?.RBC || 0;
                    const plateletCount = data.stage1_detection?.counts?.Platelets || 0;
                    const sickleCount = data.summary?.sickle_cell_count || 0;

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

                    currentCounts = {
                        wbc: currentCounts.wbc + wbcCount,
                        rbc: currentCounts.rbc + rbcCount,
                        platelets: currentCounts.platelets + plateletCount
                    };

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

                    const rbcCells = (data.cropped_cells || []).filter(cell => cell.cell_type === 'RBC');
                    currentRBCClassifications = [...currentRBCClassifications, ...rbcCells];

                    currentProcessedImages = [...currentProcessedImages, processedImage];

                    setProcessedImages(currentProcessedImages);
                    setAggregatedCounts(currentCounts);
                    setAggregatedClassifications(currentClassifications);
                    setAggregatedRBCClassifications(currentRBCClassifications);
                    setCurrentResults(data);
                    setPreviewUrl(URL.createObjectURL(file));

                    if (currentProcessedImages.length >= TARGET_IMAGE_COUNT) {
                        setThresholdMet(true);
                        const finalCalc = calculateFinalResults(currentClassifications, currentProcessedImages, currentCounts, currentRBCClassifications);
                        setFinalResults(finalCalc);

                        const sessionState = {
                            processedImages: currentProcessedImages,
                            aggregatedCounts: currentCounts,
                            aggregatedClassifications: currentClassifications,
                            aggregatedRBCClassifications: currentRBCClassifications,
                            thresholdMet: true,
                            finalResults: finalCalc,
                            currentResults: data,
                            patientData: {
                                name: patientName,
                                id: patientId,
                                age: patientAge,
                                gender: patientGender,
                                phone: patientPhone
                            },
                            isRegistered: true,
                            timestamp: Date.now()
                        };
                        saveSession(sessionState).catch(err => console.error('Failed to save session:', err));
                        break;
                    }
                } else {
                    console.error(`Failed to process image ${file.name}:`, data.error);
                }
            }

            if (currentProcessedImages.length < TARGET_IMAGE_COUNT) {
                const sessionState = {
                    processedImages: currentProcessedImages,
                    aggregatedCounts: currentCounts,
                    aggregatedClassifications: currentClassifications,
                    aggregatedRBCClassifications: currentRBCClassifications,
                    thresholdMet: false,
                    finalResults: null,
                    currentResults: currentProcessedImages[currentProcessedImages.length - 1]?.results || null,
                    patientData: {
                        name: patientName,
                        id: patientId,
                        age: patientAge,
                        gender: patientGender,
                        phone: patientPhone
                    },
                    isRegistered: true,
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
            const bulkInput = document.getElementById('bulk-upload'); // Check ID usage
            if (bulkInput) bulkInput.value = '';
        }
    };

    const handleRegistration = (e) => {
        e.preventDefault();
        if (patientName && patientId && patientAge && patientPhone) {
            setIsRegistered(true);
            // Persist registration immediately
            saveSession({
                isRegistered: true,
                patientData: {
                    name: patientName,
                    id: patientId,
                    age: patientAge,
                    gender: patientGender,
                    phone: patientPhone
                },
                processedImages: [], // Initialize empty if needed
                timestamp: Date.now()
            }).catch(console.error);
        } else {
            alert("Please fill in all required patient fields.");
        }
    };

    // Handle Save Report
    const handleSaveReport = () => {
        if (!finalResults) return;

        try {
            const reportId = Date.now();
            const timestamp = new Date().toLocaleString();

            const reportSummary = {
                totalCells: aggregatedCounts.wbc + aggregatedCounts.rbc + aggregatedCounts.platelets,
                wbcCount: aggregatedCounts.wbc,
                rbcCount: aggregatedCounts.rbc,
                plateletCount: aggregatedCounts.platelets,
                estimatedWBCCount: finalResults.estimatedWBCCount,
                estimatedRBCCount: finalResults.estimatedRBCCount,
                imagesAnalyzed: processedImages.length,
                sickleCount: finalResults.sickleCell?.count || 0
            };

            // Create a sanitized version of finalResults to avoid QuotaExceededError
            // We strip out the base64 cropped images from individual cell classifications
            // as they are not displayed in the Reports history page and take up massive space.
            const sanitizedFinalResults = {
                ...finalResults,
                wbcClassifications: finalResults.wbcClassifications?.map(cls => {
                    // eslint-disable-next-line no-unused-vars
                    const { cropped_image, ...rest } = cls;
                    return rest;
                }),
                rbcClassifications: finalResults.rbcClassifications?.map(cls => {
                    // eslint-disable-next-line no-unused-vars
                    const { cropped_image, ...rest } = cls;
                    return rest;
                })
            };

            const newReport = {
                id: reportId,
                timestamp: timestamp,
                summary: reportSummary,
                data: {
                    ...sanitizedFinalResults,
                    abnormalWBCs: finalResults.abnormalWBCs ? finalResults.abnormalWBCs.length : 0,
                    diseaseFindings: finalResults.diseaseFindings,
                    wbcDifferential: finalResults.wbcDifferential,
                    sickleCount: finalResults.sickleCell?.count || 0
                },
                patientData: {
                    name: patientName,
                    id: patientId,
                    age: patientAge,
                    gender: patientGender,
                    phone: patientPhone
                },
                imagesCount: processedImages.length,
                sessionData: {
                    analysisComplete: true,
                    totalImagesAnalyzed: processedImages.length,
                    wbcClassificationCount: finalResults.wbcClassifications ? finalResults.wbcClassifications.length : 0
                }
            };

            const existingReports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
            const updatedReports = [newReport, ...existingReports];

            localStorage.setItem('hemalyzer_reports', JSON.stringify(updatedReports));
            alert("Report saved successfully!");

        } catch (error) {
            console.error("Failed to save report:", error);
            if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
                alert("Failed to save report: Storage full. Please delete old reports from the Reports page.");
            } else {
                alert("Failed to save report. Please try again.");
            }
        }
    };

    // Handle Changing Patient (Reset)
    const handleChangePatient = () => {
        if (confirm("Change patient? This will reset the current analysis and clear all captured images.")) {
            // First run full reset to clear images and analysis data
            handleReset();

            // Then clear patient registration data
            setPatientName('');
            setPatientId('');
            setPatientAge('');
            setPatientGender('Male');
            setPatientPhone('');
            setIsRegistered(false);

            // Clear session storage for patient data specifically if needed, 
            // though handleReset calls clearSession() which should cover it.
            // We explicitly ensure it's cleared here to trigger the modal.
            clearSession();
        }
    };

    // Render Logic ==========================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 relative">
            <Header />

            <main className={`flex-grow container mx-auto px-4 py-8 transition-all duration-300 ${!isRegistered ? 'blur-sm pointer-events-none select-none opacity-50 overflow-hidden h-screen' : ''}`}>
                <div className="max-w-7xl mx-auto">
                    {/* Page Title & Patient Info */}
                    <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Blood Smear Analysis</h1>
                            <p className="text-slate-600 text-sm mt-1">
                                Upload 10 blood smear images for accurate differential count and disease assessment
                            </p>
                        </div>

                        {isRegistered && (
                            <div
                                className="text-left md:text-right group cursor-pointer bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-all border border-transparent hover:border-slate-300 relative"
                                onClick={handleChangePatient}
                                title="Click to change patient"
                            >
                                <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs text-slate-400 font-medium group-hover:text-blue-600 transition-colors uppercase tracking-wider">Change Patient</span>
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </div>
                                <p className="text-slate-900 font-bold text-lg">{patientName}</p>
                                <p className="text-slate-500 text-sm font-mono">{patientId}</p>
                            </div>
                        )}
                    </div>

                    {/* Final Results if Threshold Met */}
                    {thresholdMet && finalResults && (
                        <div className="mb-8">
                            <FinalResults
                                aggregatedResults={finalResults}
                                processedImages={processedImages}
                                patientName={patientName}
                                patientId={patientId}
                                patientAge={patientAge}
                                patientGender={patientGender}
                                patientPhone={patientPhone}
                                onReset={handleReset}
                                saveReport={handleSaveReport}
                            />
                        </div>
                    )}

                    {/* Threshold Results (Intermediate) - keeping strict compatibility if needed, but FinalResults typically covers it */}
                    {!finalResults && thresholdMet && (
                        /* Fallback or intermediate state */
                        <ThresholdResults
                            processedImages={processedImages}
                            analysisResults={calculateFinalResults(aggregatedClassifications, processedImages, aggregatedCounts, aggregatedRBCClassifications)}
                        />
                    )}


                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* LEFT COLUMN: Upload & Guidelines */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Guidelines */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
                                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Instructions
                                </h2>
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                    <p className="text-xs text-amber-800 font-medium">
                                        Images <strong>MUST</strong> be taken at <strong>x100 Magnification (Oil Immersion)</strong>.
                                        Lower magnifications (x10, x40) will result in inaccurate classification.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-1">
                                            <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-xs">1</span>
                                            Image Acquisition
                                        </h3>
                                        <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
                                            <li>Standard Wright-Giemsa stained PBS</li>
                                            <li>Avoid blurred or over-exposed images</li>
                                            <li>Supported formats: <strong>JPG, PNG</strong></li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-1">
                                            <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-xs">2</span>
                                            Analysis Workflow
                                        </h3>
                                        <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
                                            <li>Upload <strong>10 distinct fields</strong> of view</li>
                                            <li>System accumulates cell counts per field</li>
                                            <li>Final report generates automatically</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Upload Section Component */}
                            <UploadSection
                                processedImages={processedImages}
                                targetImageCount={TARGET_IMAGE_COUNT}
                                previewUrl={previewUrl}
                                selectedFile={selectedFile}
                                loading={loading}
                                thresholdMet={thresholdMet}
                                handleFileChange={handleFileChange}
                                handleBulkFileChange={handleBulkFileChange}
                                bulkFiles={bulkFiles}
                                setBulkFiles={setBulkFiles}
                                setError={setError}
                                handleBulkUpload={handleBulkUpload}
                                isBulkProcessing={isBulkProcessing}
                                bulkProgress={bulkProgress}
                                analysisProgress={analysisProgress}
                                handleAnalyze={handleAnalyze}
                                error={error}
                                aggregatedCounts={aggregatedCounts}
                                handleReset={handleReset}
                            />
                        </div>

                        {/* RIGHT COLUMN: Results */}
                        <div className="lg:col-span-2 space-y-6">
                            <ProcessedImagesThumbnails
                                processedImages={processedImages}
                                currentImageCount={processedImages.length}
                                targetImageCount={TARGET_IMAGE_COUNT}
                            />

                            <AnalysisResults
                                currentResults={currentResults}
                                loading={loading}
                                showCurrentResults={showCurrentResults}
                                toggleResults={() => setShowCurrentResults(!showCurrentResults)}
                                onViewClassifications={() => setShowClassificationsModal(true)}
                                previewUrl={previewUrl}
                            />
                        </div>
                    </div>
                </div>
            </main>

            <Footer />

            {/* Registration Modal Overlay */}
            {!isRegistered && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <RegistrationForm
                        patientName={patientName}
                        setPatientName={setPatientName}
                        patientId={patientId}
                        setPatientId={setPatientId}
                        patientAge={patientAge}
                        setPatientAge={setPatientAge}
                        patientGender={patientGender}
                        setPatientGender={setPatientGender}
                        patientPhone={patientPhone}
                        setPatientPhone={setPatientPhone}
                        onRegister={handleRegistration}
                    />
                </div>
            )}

            <ClassificationsModal
                show={showClassificationsModal}
                onClose={() => setShowClassificationsModal(false)}
                currentResults={currentResults}
                isBulkProcessing={isBulkProcessing}
            />
        </div>
    );
};

export default Homepage;