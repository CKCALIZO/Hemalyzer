
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { saveSession, loadSession, clearSession, migrateFromLocalStorage } from '../utils/sessionStorage';
import { API_URL, getApiHeaders } from '../config/api';

const AnalysisContext = createContext();
const TARGET_IMAGE_COUNT = 10;
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

// --- Clinical Analysis Helper Functions (Module Scope) ---

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

// Sickle Cell Clinical Analysis Helper
const getSickleCellAnalysis = (severity) => {
    if (severity === 'SEVERE') {
        return {
            interpretation: 'Severe Sickle Cell Anemia (HbSS): High percentage of sickled cells detected, consistent with sickle cell disease crisis or homozygous state.',
            recommendation: 'Clinical Recommendation: URGENT hematology consultation. Evaluate for vaso-occlusive crisis. Confirm with Hb Electrophoresis.'
        };
    } else if (severity === 'MODERATE') {
        return {
            interpretation: 'Moderate Sickling: Significant presence of sickled cells, suggestive of Sickle Cell Disease or related hemoglobinopathy.',
            recommendation: 'Clinical Recommendation: Hematology referral recommended. Correlation with clinical symptoms and confirmatory testing required.'
        };
    } else if (severity === 'MILD') {
        return {
            interpretation: 'Mild Sickling (HbAS): Lower percentage of sickled cells, often seen in Sickle Cell Trait or compound heterozygotes.',
            recommendation: 'Clinical Recommendation: Genetic counseling and family screening suggested. Generally asymptomatic but requires awareness.'
        };
    } else {
        return {
            interpretation: 'Normal / Trace Findings: Sickle cells absent or present in trace amounts (< 3%) below diagnostic significance.',
            recommendation: 'Clinical Recommendation: Likely normal variant or artifact. No specific intervention required in absence of clinical symptoms.'
        };
    }
};

// Disease Recommendations
const getDiseaseRecommendation = (type, severity) => {
    if (severity === 'HIGH') {
        return `Diagnostic level for ${type}. Urgent Hematology Referral Required.`;
    } else if (severity === 'MODERATE') {
        return `Suspicious for ${type}. Bone Marrow Biopsy / Further testing recommended.`;
    } else {
        return `Low/Normal levels. Clinical correlation recommended.`;
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

    // Calculate aggregated results
    const calculateFinalResults = useCallback((allClassifications, allProcessedImages, counts, allRBCClassifications = []) => {
        const wbcTypeCounts = {};
        const mainWBCCategories = ['Neutrophil', 'Lymphocyte', 'Monocyte', 'Eosinophil', 'Basophil'];
        const differentialCounts = { 'Neutrophil': 0, 'Lymphocyte': 0, 'Monocyte': 0, 'Eosinophil': 0, 'Basophil': 0 };

        let cmlCount = 0, cllCount = 0, allCount = 0, amlCount = 0;
        let lymphoblastNormalCount = 0, lymphocyteNormalCount = 0;  // For monitoring
        const cmlGranulocyteBreakdown = { basophil: 0, eosinophil: 0, myeloblast: 0, promyelocyte: 0, myelocyte: 0, metamyelocyte: 0, neutrophil: 0 };
        const blastBreakdown = { lymphoblast: 0, myeloblast: 0 };
        const abnormalWBCs = [];

        allClassifications.forEach(cls => {
            const classification = cls.classification || '';
            wbcTypeCounts[classification] = (wbcTypeCounts[classification] || 0) + 1;
            const classificationStr = (cls.classification || '').toLowerCase();

            const hasCML = classificationStr.includes(': cml');
            const hasCLL = classificationStr.includes(': cll');
            const hasAML = classificationStr.includes(': aml');
            const hasALL = classificationStr.includes(': all');

            const isNeutrophil = classificationStr.includes('neutrophil');
            const isLymphocyte = classificationStr.includes('lymphocyte');
            const isMonocyte = classificationStr.includes('monocyte');
            const isEosinophil = classificationStr.includes('eosinophil') || classificationStr.includes('eosonophil');
            const isBasophil = classificationStr.includes('basophil');
            const isMyeloblast = classificationStr.includes('myeloblast');
            const isLymphoblast = classificationStr.includes('lymphoblast') || classificationStr.includes('b_lymphoblast');
            const isPromyelocyte = classificationStr.includes('promyelocyte');
            const isMetamyelocyte = classificationStr.includes('metamyelocyte');
            const isMyelocyte = classificationStr.includes('myelocyte') && !isPromyelocyte && !isMetamyelocyte;

            // Only count mature main WBC types in the differential
            // Immature cells (Promyelocyte, Myelocyte, Metamyelocyte, Myeloblast, Lymphoblast) 
            // are tracked separately as disease indicators, not in the main differential
            if (isNeutrophil) {
                differentialCounts['Neutrophil']++;
            } else if (isLymphocyte) {
                differentialCounts['Lymphocyte']++;
            } else if (isMonocyte) {
                differentialCounts['Monocyte']++;
            } else if (isEosinophil) {
                differentialCounts['Eosinophil']++;
            } else if (isBasophil) {
                differentialCounts['Basophil']++;
            }
            // Note: Promyelocyte, Myelocyte, Metamyelocyte, Myeloblast, Lymphoblast 
            // are NOT counted in the main 5-part differential

            if (!classificationStr.includes('normal') && cls.classification) {
                abnormalWBCs.push(cls);
            }

            if (hasCML) {
                cmlCount++;
                if (isBasophil) cmlGranulocyteBreakdown.basophil++;
                else if (isEosinophil) cmlGranulocyteBreakdown.eosinophil++;
                else if (isMyeloblast) cmlGranulocyteBreakdown.myeloblast++;
                else if (isNeutrophil) cmlGranulocyteBreakdown.neutrophil++;
                else if (isPromyelocyte) cmlGranulocyteBreakdown.promyelocyte++;
                else if (isMyelocyte) cmlGranulocyteBreakdown.myelocyte++;
                else if (isMetamyelocyte) cmlGranulocyteBreakdown.metamyelocyte++;
            }

            if (hasCLL) cllCount++;

            if (hasALL) {
                allCount++;
                blastBreakdown.lymphoblast++;
            }

            if (hasAML) {
                amlCount++;
                blastBreakdown.myeloblast++;
            }

            // Track Lymphoblast:Normal and Lymphocyte:Normal for monitoring
            const isNormalVariant = classificationStr.includes(': normal');
            if (isLymphoblast && isNormalVariant) {
                lymphoblastNormalCount++;
            }
            if (isLymphocyte && isNormalVariant) {
                lymphocyteNormalCount++;
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
                count, percentage, normalRange: normalRange ? `${normalRange.min}-${normalRange.max}%` : '-', status,
                clinInterpretation: getClinicalAnalysis(category, status).interpretation,
                clinRecommendation: getClinicalAnalysis(category, status).recommendation
            };
        });

        const blastCount = amlCount + allCount;
        const cmlPercentage = totalWBC > 0 ? (cmlCount / totalWBC) * 100 : 0;
        const cllPercentage = totalWBC > 0 ? (cllCount / totalWBC) * 100 : 0;
        const diseaseFindings = [];

        if (amlCount > 0) {
            const amlPercentage = totalWBC > 0 ? (amlCount / totalWBC) * 100 : 0;
            let interpretation = '', severity = 'NORMAL';
            if (amlPercentage >= 20) { interpretation = 'Diagnostic level for AML'; severity = 'HIGH'; }
            else if (amlPercentage >= 10) { interpretation = 'Suspicious / Pre-leukemic (AML)'; severity = 'MODERATE'; }
            else { interpretation = 'Myeloblasts detected'; severity = 'NORMAL'; }
            diseaseFindings.push({
                type: 'AML (Acute Myeloblastic Leukemia)', percentage: amlPercentage, interpretation, severity,
                condition: 'Acute Myeloid Leukemia', breakdown: { "AML:Myeloblast": blastBreakdown.myeloblast },
                recommendation: getDiseaseRecommendation('AML', severity)
            });
        }

        if (allCount > 0) {
            const allPercentage = totalWBC > 0 ? (allCount / totalWBC) * 100 : 0;
            let interpretation = '', severity = 'NORMAL', condition = 'Monitor for ALL';
            if (allPercentage > 80) { interpretation = 'Advanced / Progressive ALL'; condition = 'ALL (Advanced)'; severity = 'HIGH'; }
            else if (allPercentage >= 66) { interpretation = 'Typical ALL'; condition = 'ALL'; severity = 'HIGH'; }
            else if (allPercentage >= 51) { interpretation = 'Suspicious for Early ALL'; condition = 'Suspicious for Early ALL'; severity = 'MODERATE'; }
            else if (allPercentage >= 35) { interpretation = 'Reactive / Secondary Lymphocytosis'; condition = 'Reactive Lymphocytosis'; severity = 'LOW'; }
            else { interpretation = 'ALL-marked cells detected but below threshold'; }
            diseaseFindings.push({
                type: 'ALL (Acute Lymphoblastic Leukemia)', percentage: allPercentage, interpretation, severity,
                condition, breakdown: { "ALL:B_Lymphoblast": blastBreakdown.lymphoblast },
                recommendation: getDiseaseRecommendation('ALL', severity)
            });
        }

        if (cmlCount > 0) {
            let interpretation = '', severity = 'NORMAL', condition = 'Monitor for CML';
            if (cmlPercentage >= 20) { interpretation = 'Diagnostic level for CML'; condition = 'Chronic Myeloid Leukemia'; severity = 'HIGH'; }
            else if (cmlPercentage >= 10) { interpretation = 'Suspicious / Pre-leukemic (CML)'; condition = 'Suspicious for CML'; severity = 'MODERATE'; }
            else { interpretation = 'CML-marked cells detected but below threshold'; }

            const cmlBreakdown = {};
            if (cmlGranulocyteBreakdown.basophil > 0) cmlBreakdown["CML:Basophil"] = cmlGranulocyteBreakdown.basophil;
            if (cmlGranulocyteBreakdown.eosinophil > 0) cmlBreakdown["CML:Eosinophil"] = cmlGranulocyteBreakdown.eosinophil;
            if (cmlGranulocyteBreakdown.myeloblast > 0) cmlBreakdown["CML:Myeloblast"] = cmlGranulocyteBreakdown.myeloblast;
            if (cmlGranulocyteBreakdown.promyelocyte > 0) cmlBreakdown["CML:Promyelocyte"] = cmlGranulocyteBreakdown.promyelocyte;
            if (cmlGranulocyteBreakdown.myelocyte > 0) cmlBreakdown["CML:Myelocyte"] = cmlGranulocyteBreakdown.myelocyte;
            if (cmlGranulocyteBreakdown.metamyelocyte > 0) cmlBreakdown["CML:Metamyelocyte"] = cmlGranulocyteBreakdown.metamyelocyte;
            if (cmlGranulocyteBreakdown.neutrophil > 0) cmlBreakdown["CML:Neutrophil"] = cmlGranulocyteBreakdown.neutrophil;

            diseaseFindings.push({
                type: 'CML (Chronic Myeloid Leukemia)', percentage: cmlPercentage, interpretation, severity, condition, breakdown: cmlBreakdown,
                recommendation: getDiseaseRecommendation('CML', severity)
            });
        }

        if (cllCount > 0) {
            let interpretation = '', severity = 'NORMAL', condition = 'Monitor for CLL';
            if (cllPercentage > 80) { interpretation = 'Advanced / Progressive CLL'; condition = 'CLL (Advanced)'; severity = 'HIGH'; }
            else if (cllPercentage >= 66) { interpretation = 'Typical CLL'; condition = 'CLL'; severity = 'HIGH'; }
            else if (cllPercentage >= 51) { interpretation = 'Suspicious for Early CLL'; condition = 'Suspicious for Early CML'; severity = 'MODERATE'; }
            else if (cllPercentage >= 35) { interpretation = 'Reactive / Secondary Lymphocytosis'; condition = 'Reactive Lymphocytosis'; severity = 'LOW'; }
            else { interpretation = 'CLL-marked cells detected but below threshold'; }
            diseaseFindings.push({
                type: 'CLL (Chronic Lymphocytic Leukemia)', percentage: cllPercentage, interpretation, severity, condition, breakdown: { "CLL:Lymphocytes": cllCount },
                recommendation: getDiseaseRecommendation('CLL', severity)
            });
        }

        // Monitor for ALL: High Lymphoblast:Normal count (>= 20% of WBCs)
        const lymphoblastNormalPercentage = totalWBC > 0 ? (lymphoblastNormalCount / totalWBC) * 100 : 0;
        if (lymphoblastNormalCount > 0 && lymphoblastNormalPercentage >= 20) {
            diseaseFindings.push({
                type: 'Monitor for ALL',
                percentage: lymphoblastNormalPercentage,
                interpretation: 'Elevated normal lymphoblasts detected. Recommend monitoring for potential ALL development.',
                severity: 'LOW',
                condition: 'Monitor for ALL',
                breakdown: { "Lymphoblast:Normal": lymphoblastNormalCount },
                recommendation: 'Clinical Recommendation: Serial CBC monitoring. Repeat in 2-4 weeks. Consider flow cytometry if persistent.'
            });
        }

        // Monitor for CLL: High Lymphocyte:Normal count (>= 40% of WBCs)
        const lymphocyteNormalPercentage = totalWBC > 0 ? (lymphocyteNormalCount / totalWBC) * 100 : 0;
        if (lymphocyteNormalCount > 0 && lymphocyteNormalPercentage >= 40) {
            diseaseFindings.push({
                type: 'Monitor for CLL',
                percentage: lymphocyteNormalPercentage,
                interpretation: 'Elevated normal lymphocytes detected. Recommend monitoring for potential CLL development.',
                severity: 'LOW',
                condition: 'Monitor for CLL',
                breakdown: { "Lymphocyte:Normal": lymphocyteNormalCount },
                recommendation: 'Clinical Recommendation: Serial CBC monitoring. Repeat in 3 months. Consider immunophenotyping if lymphocyte count persists above normal.'
            });
        }

        let sickleCount = 0;
        allProcessedImages.forEach(img => { if (img.sickleCount) sickleCount += img.sickleCount; });
        const sicklePercentage = counts.rbc > 0 ? (sickleCount / counts.rbc) * 100 : 0;
        let sickleInterpretation = 'Normal blood', sickleSeverity = 'NORMAL';
        if (sicklePercentage > 30) { sickleInterpretation = 'Severe Sickle Cell Anemia (HbSS)'; sickleSeverity = 'SEVERE'; }
        else if (sicklePercentage >= 10) { sickleInterpretation = 'Moderate Sickling'; sickleSeverity = 'MODERATE'; }
        else if (sicklePercentage >= 3) { sickleInterpretation = 'Mild Sickling (HbAS)'; sickleSeverity = 'MILD'; }
        else if (sicklePercentage > 0) { sickleInterpretation = 'Normal blood (< 3%)'; }

        let patientStatus = 'Normal';
        const hasCritical = diseaseFindings.some(f => f.severity === 'HIGH');
        const hasAbnormal = diseaseFindings.some(f => f.severity === 'MODERATE' || f.severity === 'LOW');
        // Also mark as Abnormal if high Lymphoblast:Normal or Lymphocyte:Normal counts
        const hasMonitoringConcern = (lymphoblastNormalPercentage >= 20) || (lymphocyteNormalPercentage >= 40);
        if (hasCritical || sicklePercentage > 30) patientStatus = 'Critical';
        else if (hasAbnormal || sicklePercentage >= 3 || hasMonitoringConcern) patientStatus = 'Abnormal';

        return {
            thresholdMet: true, totalWBC: counts.wbc, totalRBC: counts.rbc, totalPlatelets: counts.platelets,
            estimatedWBCCount, estimatedRBCCount, avgRBCPerField: averageRBCPerImage,
            wbcClassifications: allClassifications, rbcClassifications: allRBCClassifications,
            abnormalWBCs, wbcDifferential, diseaseFindings, classificationCounts: wbcTypeCounts,
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
                    wbcDifferential: finalResults.wbcDifferential,
                    diseaseFindings: finalResults.diseaseFindings,
                    abnormalWBCs: finalResults.abnormalWBCs ? finalResults.abnormalWBCs.length : 0,
                    classificationCounts: finalResults.classificationCounts,
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
