import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * FinalResults Component
 * Displays final diagnosis when 10 images threshold is met
 * Includes printable PDF report functionality
 * Includes scrollable WBC examination section for manual review
 * 
 * Cell Count Formulas:
 * - RBC count: (Avg RBC in 10 images) x 200,000
 * - WBC count: (Overall WBC count / 10) x 2,000
 * 
 * WBC Differential - 5 Main Categories with Normal Ranges:
 * - Neutrophil: 45% - 65%
 * - Lymphocyte: 20% - 35%
 * - Monocyte: 2% - 6%
 * - Eosinophil: 2% - 4%
 * - Basophil: 0% - 1%
 */
export const FinalResults = ({
    aggregatedResults,
    processedImages,
    onReset,
    saveReport,
    patientName,
    patientId,
    patientAge,
    patientGender,
    patientPhone
}) => {
    const navigate = useNavigate();
    const [showWBCExamination, setShowWBCExamination] = useState(false);
    const [showRBCExamination, setShowRBCExamination] = useState(false);
    const [showAbnormalWBCs, setShowAbnormalWBCs] = useState(false);
    const [wbcFilter, setWbcFilter] = useState('all');
    const [rbcFilter, setRbcFilter] = useState('all');
    const [expandedDiseaseCard, setExpandedDiseaseCard] = useState(null); // Track which disease card is expanded
    const [expandedSickleCell, setExpandedSickleCell] = useState(false); // Track sickle cell expansion
    const [activeTab, setActiveTab] = useState('overview'); // Tabs: overview, analysis, counts

    if (!aggregatedResults || !aggregatedResults.thresholdMet) {

        return null;
    }

    const {
        totalWBC,
        totalRBC,
        totalPlatelets,
        estimatedWBCCount,
        estimatedRBCCount,
        avgRBCPerField,
        wbcClassifications,
        abnormalWBCs,
        diseaseFindings,
        wbcDifferential,
        sickleCell,
        patientStatus
    } = aggregatedResults;

    // Get classification category based on ConvNeXt class
    // Model classes are in format: "CellType: Condition" (e.g., "Basophil: Normal", "Basophil: CML")
    const getClassificationCategory = (classification) => {
        if (!classification) {
            return { category: 'Other', label: 'Unknown', color: 'bg-slate-100 text-slate-800 border-slate-300' };
        }

        const lowerClass = classification.toLowerCase();

        // Check for disease markers in the classification string
        // ALL (Acute Lymphoblastic Leukemia)
        if (lowerClass.includes(': all') || lowerClass.includes('lymphoblast: all') || lowerClass.includes('b_lymphoblast: all')) {
            const cellType = classification.split(':')[0] || 'Lymphoblast';
            return { category: 'ALL', label: `ALL: ${cellType}`, color: 'bg-red-100 text-red-800 border-red-300' };
        }

        // AML (Acute Myeloid Leukemia)
        if (lowerClass.includes(': aml') || lowerClass.includes('myeloblast: aml')) {
            const cellType = classification.split(':')[0] || 'Myeloblast';
            return { category: 'AML', label: `AML: ${cellType}`, color: 'bg-red-100 text-red-800 border-red-300' };
        }

        // CML (Chronic Myeloid Leukemia)
        if (lowerClass.includes(': cml')) {
            const cellType = classification.split(':')[0] || 'Granulocyte';
            return { category: 'CML', label: `CML: ${cellType}`, color: 'bg-amber-100 text-amber-800 border-amber-300' };
        }

        // CLL (Chronic Lymphocytic Leukemia)
        if (lowerClass.includes(': cll')) {
            const cellType = classification.split(':')[0] || 'Lymphocyte';
            return { category: 'CLL', label: `CLL: ${cellType}`, color: 'bg-amber-100 text-amber-800 border-amber-300' };
        }

        // Sickle Cell (RBC condition)
        if (lowerClass.includes('sickle')) {
            return { category: 'Sickle', label: 'Sickle Cell', color: 'bg-red-100 text-red-800 border-red-300' };
        }

        // Normal cells - check for ": normal" pattern or just Normal WBC types
        if (lowerClass.includes(': normal') || lowerClass === 'normal') {
            const cellType = classification.split(':')[0] || 'WBC';
            return { category: 'Normal', label: cellType.trim(), color: 'bg-green-100 text-green-800 border-green-300' };
        }

        // Handle legacy class names (without ":" format)
        const normalCellTypes = ['basophil', 'eosinophil', 'neutrophil', 'lymphocyte', 'monocyte', 'erythroblast', 'metamyelocyte', 'myelocyte', 'promyelocyte', 'platelet'];
        if (normalCellTypes.some(type => lowerClass === type)) {
            return { category: 'Normal', label: classification, color: 'bg-green-100 text-green-800 border-green-300' };
        }

        return { category: 'Other', label: classification, color: 'bg-slate-100 text-slate-800 border-slate-300' };
    };

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

    // Filter WBCs based on selected filter
    const getFilteredWBCs = () => {
        if (!wbcClassifications) return [];
        if (wbcFilter === 'all') return wbcClassifications;
        if (wbcFilter === 'abnormal') {
            return wbcClassifications.filter(wbc => {
                const cat = getClassificationCategory(wbc.classification);
                return cat.category !== 'Normal';
            });
        }
        return wbcClassifications.filter(wbc => {
            const cat = getClassificationCategory(wbc.classification);
            return cat.category === wbcFilter;
        });
    };

    // Count WBCs by category
    const getCategoryCounts = () => {
        if (!wbcClassifications) return {};
        const counts = { 'Normal': 0, 'AML': 0, 'ALL': 0, 'CML': 0, 'CLL': 0, 'Other': 0 };
        wbcClassifications.forEach(wbc => {
            const cat = getClassificationCategory(wbc.classification);
            counts[cat.category] = (counts[cat.category] || 0) + 1;
        });
        return counts;
    };

    const categoryCounts = getCategoryCounts();
    const filteredWBCs = getFilteredWBCs();

    // Get severity styling
    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'critical':
                return 'bg-red-50 border-red-600 text-red-800';
            case 'abnormal':
                return 'bg-amber-50 border-amber-600 text-amber-800';
            case 'normal':
            default:
                return 'bg-green-50 border-green-600 text-green-800';
        }
    };

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'critical':
                return '!';
            case 'abnormal':
                return '*';
            case 'normal':
            default:
                return '';
        }
    };
    // saveReport is now passed as a prop from Homepage.jsx

    // Generate PDF Report
    const generatePDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let yPos = 20;

        // Header
        doc.setFillColor(30, 58, 95);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("HEMALYZER", margin, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Blood Cell Analysis Report", margin, 33);

        // Report metadata
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        const dateStr = new Date().toLocaleString();
        doc.text(`Generated: ${dateStr}`, pageWidth - margin - 60, 25);
        doc.text(`Images Analyzed: ${processedImages.length}`, pageWidth - margin - 60, 33);

        yPos = 50;

        // Patient Information
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, 45, pageWidth - 2 * margin, 25, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, 45, pageWidth - 2 * margin, 25, 2, 2, 'S');

        doc.setTextColor(30, 58, 95);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("PATIENT INFORMATION:", margin + 5, 53);

        doc.setFont("helvetica", "normal");
        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${patientName || 'N/A'}`, margin + 5, 62);
        doc.text(`ID: ${patientId || 'N/A'}`, pageWidth / 2, 62);

        doc.text(`Age: ${patientAge || 'N/A'}`, margin + 5, 68);
        doc.text(`Gender: ${patientGender || 'N/A'}`, margin + 50, 68);
        doc.text(`Phone: ${patientPhone || 'N/A'}`, pageWidth / 2, 68);

        yPos = 80;

        // Patient Status Banner
        doc.setFillColor(
            patientStatus === 'Critical' ? 220 : patientStatus === 'Abnormal' ? 245 : 220,
            patientStatus === 'Critical' ? 53 : patientStatus === 'Abnormal' ? 158 : 252,
            patientStatus === 'Critical' ? 69 : patientStatus === 'Abnormal' ? 11 : 231
        );
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`OVERALL STATUS: ${patientStatus?.toUpperCase() || 'NORMAL'}`, margin + 5, yPos + 13);

        yPos += 30;

        // Cell Count Summary
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Cell Count Summary", margin, yPos);
        yPos += 8;

        autoTable(doc, {
            startY: yPos,
            head: [['Cell Type', 'Detected', 'Estimated Count', 'Formula']],
            body: [
                ['White Blood Cells (WBC)', totalWBC.toString(), `${estimatedWBCCount?.toLocaleString() || 0}/µL`, `(${totalWBC}/10) × 2,000`],
                ['Red Blood Cells (RBC)', totalRBC.toString(), `${estimatedRBCCount?.toLocaleString() || 0}/µL`, `(${avgRBCPerField?.toFixed(1) || 0} avg) × 200,000`],
                ['Platelets', totalPlatelets.toString(), '-', '-']
            ],
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 95], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // WBC Differential - 5 Main Categories
        if (wbcDifferential && Object.keys(wbcDifferential).length > 0) {
            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("WBC Differential (5 Main Categories)", margin, yPos);
            yPos += 8;

            const diffData = Object.entries(wbcDifferential).map(([name, data]) => [
                name,
                `${data.count}`,
                `${data.percentage.toFixed(1)}%`,
                data.normalRange || '-',
                data.status === 'normal' ? 'Normal' : data.status === 'high' ? 'HIGH' : 'LOW'
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Cell Type', 'Count', 'Percentage', 'Normal Range', 'Status']],
                body: diffData,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 3 },
                margin: { left: margin, right: margin },
                didDrawCell: (data) => {
                    // Color code status column
                    if (data.column.index === 4 && data.section === 'body') {
                        const status = data.cell.text[0];
                        if (status === 'HIGH') {
                            doc.setFillColor(254, 226, 226);
                        } else if (status === 'LOW') {
                            doc.setFillColor(219, 234, 254);
                        } else {
                            doc.setFillColor(220, 252, 231);
                        }
                    }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            // Detailed Clinical Interpretation Section
            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Clinical Interpretation & Recommendations", margin, yPos);
            yPos += 8;

            const interpretationBody = Object.entries(wbcDifferential).map(([name, data]) => {
                const analysis = getClinicalAnalysis(name, data.status);
                return [
                    { content: `${name} (${data.status === 'normal' ? 'Normal' : data.status.toUpperCase()})`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                    { content: `Interpretation: ${analysis.interpretation}\n\n${analysis.recommendation}`, styles: { cellPadding: 3 } }
                ];
            });

            autoTable(doc, {
                startY: yPos,
                body: interpretationBody,
                theme: 'grid',
                showHead: false,
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 'auto' }
                },
                styles: { fontSize: 9, cellPadding: 4, valign: 'top' },
                margin: { left: margin, right: margin }
            });


            yPos = doc.lastAutoTable.finalY + 15;
        }

        // Disease Findings
        if (diseaseFindings && diseaseFindings.length > 0) {
            // Check if we need a new page
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }

            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Disease Analysis Findings", margin, yPos);
            yPos += 8;

            const findingsData = diseaseFindings.map(finding => [
                finding.type || '-',
                `${finding.percentage?.toFixed(1) || 0}%`,
                finding.interpretation || '-',
                finding.severity || '-'
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Disease Type', 'Percentage', 'Interpretation', 'Severity']],
                body: findingsData,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 2: { cellWidth: 60 } },
                margin: { left: margin, right: margin }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // Sickle Cell Analysis
        if (sickleCell) {
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Sickle Cell Analysis", margin, yPos);
            yPos += 8;

            autoTable(doc, {
                startY: yPos,
                head: [['Metric', 'Value']],
                body: [
                    ['Sickle Cells Detected', sickleCell.count?.toString() || '0'],
                    ['Total RBCs Analyzed', sickleCell.totalRBC?.toString() || '0'],
                    ['Percentage', `${sickleCell.percentage?.toFixed(2) || 0}%`],
                    ['Interpretation', sickleCell.interpretation || 'Normal']
                ],
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                styles: { fontSize: 10, cellPadding: 4 },
                margin: { left: margin, right: margin }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // Analysis Justification & Methodology
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(240, 249, 255);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');
        doc.setDrawColor(186, 230, 253);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'S');

        doc.setTextColor(30, 58, 95);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("ANALYSIS METHODOLOGY & JUSTIFICATION", margin + 5, yPos + 8);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const methodology = "This analysis is derived from automated computer vision processing of 10 high-power field (100x) images. Cell counts are extrapolated using standard conversion formulas. Disease markers are identified based on specific cellular morphological features consistent with clinical hematology standards.";
        const splitMethod = doc.splitTextToSize(methodology, pageWidth - 2 * margin - 10);
        doc.text(splitMethod, margin + 5, yPos + 14);

        yPos += 35;

        // Clinical Recommendations
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Recommendations & Interpretation", margin, yPos);
        yPos += 8;

        let recommendations = [];
        if (patientStatus === 'Critical' || patientStatus === 'Abnormal') {
            recommendations.push("• IMPERATIVE: Immediate review of peripheral blood smear by a qualified hematologist.");
            recommendations.push("• Correlate findings with patient's clinical presentation, CBC, and other laboratory markers.");
            if (diseaseFindings.some(f => f.type.includes('Leukemia'))) {
                recommendations.push("• Consider Flow Cytometry and Bone Marrow Biopsy for definitive diagnosis/classification.");
            }
            if (sickleCell && sickleCell.count > 0) {
                recommendations.push("• Confirm Sickle Cell presence with Hemoglobin Electrophoresis or HPLC.");
            }
        } else {
            recommendations.push("• Results appear within normal limits; however, clinical correlation is always advised.");
            recommendations.push("• Routine follow-up as per standard clinical protocols.");
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        recommendations.forEach(rec => {
            doc.text(rec, margin, yPos);
            yPos += 6;
        });

        yPos += 15;

        // Footer / Disclaimer
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 2, 2, 'F');

        doc.setTextColor(190, 20, 20); // Red hue for disclaimer title
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("MEDICAL DISCLAIMER - PLEASE READ CAREFULLY", margin + 5, yPos + 8);

        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "normal");
        const disclaimer = "This report is generated by an Artificial Intelligence (AI) system and is intended for RESEARCH AND EDUCATIONAL PURPOSES ONLY. It is NOT a diagnostic tool and must NOT be used as a substitute for professional medical advice, diagnosis, or treatment. All results must be verified by a board-certified pathologist or hematologist. The developers assume no liability for the use of this data in clinical decision-making.";
        const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin - 10);
        doc.text(splitDisclaimer, margin + 5, yPos + 15);

        // Save the PDF
        const fileName = `Hemalyzer_Report_${patientId ? patientId + '_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="bg-white rounded-lg border-2 border-slate-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl"></span>
                            Final Analysis Report
                        </h2>
                        <p className="text-slate-300 text-sm mt-1">
                            Analysis complete - 10 images processed
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-300">Images Analyzed</p>
                        <p className="text-2xl font-bold">{processedImages.length}</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border-b border-slate-200 px-6">
                <nav className="flex gap-6 overflow-x-auto" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'analysis'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Detailed Analysis
                    </button>
                    <button
                        onClick={() => setActiveTab('counts')}
                        className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'counts'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Cell Counts & Raw Data
                    </button>
                </nav>
            </div>

            {/* Enhanced Patient Status Banner with Detailed Counts and Condition Assessment */}
            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="bg-slate-50">
                    <div className={`px-6 py-6 border-l-4 bg-white border-b border-slate-200 ${getStatusStyle(patientStatus)}`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-4xl shadow-sm rounded-full bg-white p-2">
                                        {patientStatus === 'Critical' ? (
                                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ) : patientStatus === 'Abnormal' ? (
                                            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        ) : (
                                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        )}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium opacity-75 text-slate-500">Overall Patient Status</p>
                                        <p className="text-3xl font-bold text-slate-800">{patientStatus || 'Normal'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm opacity-75 text-slate-500">Total WBCs Counted</p>
                                    <p className="text-4xl font-bold text-slate-800">{totalWBC}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <h3 className="text-lg font-semibold text-slate-700 mb-4">Classification Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-sm font-medium text-slate-500 mb-1">Classified WBCs</p>
                                <p className="text-3xl font-bold text-slate-800">{totalWBC}</p>
                            </div>
                            <div className={`bg-white p-4 rounded-xl border shadow-sm ${abnormalWBCs.length > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
                                <p className="text-sm font-medium text-slate-500 mb-1">Abnormal WBCs</p>
                                <p className={`text-3xl font-bold ${abnormalWBCs.length > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{abnormalWBCs.length}</p>
                                <p className="text-xs text-slate-500 mt-1">{totalWBC > 0 ? ((abnormalWBCs.length / totalWBC) * 100).toFixed(1) : 0}% of detected</p>
                            </div>
                            <div className={`bg-white p-4 rounded-xl border shadow-sm ${sickleCell.count > 0 ? 'border-red-200' : 'border-slate-200'}`}>
                                <p className="text-sm font-medium text-slate-500 mb-1">Sickle Cells</p>
                                <p className={`text-3xl font-bold ${sickleCell.count > 0 ? 'text-red-600' : 'text-slate-700'}`}>{sickleCell.count}</p>
                                <p className="text-xs text-slate-500 mt-1">{totalRBC > 0 ? ((sickleCell.count / totalRBC) * 100).toFixed(1) : 0}% of RBCs</p>
                            </div>
                        </div>
                    </div>

                    {sickleCell && (
                        <div className="px-6 py-5 border-t border-slate-200 bg-white">
                            <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                Sickle Cell Analysis
                            </h3>
                            <div className={`p-4 rounded-lg border ${sickleCell.count > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800">{sickleCell.count > 0 ? 'Sickle Cells Detected' : 'Normal RBC Morphology'}</p>
                                        <p className="text-sm text-slate-600">{sickleCell.percentage.toFixed(2)}% of RBCs show sickling.</p>
                                    </div>
                                    <span className="text-2xl font-bold">{sickleCell.percentage.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: DETAILED ANALYSIS */}
            {activeTab === 'analysis' && (
                <div>
                    <div className="px-6 py-6 border-b border-slate-200 bg-white">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">Disease Analysis</h3>
                        <p className="text-sm text-slate-500 mb-4">Specific leukemia markers based on cellular morphology.</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {['AML', 'ALL', 'CML', 'CLL'].map(diseaseType => {
                                const finding = diseaseFindings.find(f => f.type.includes(diseaseType));
                                const pct = finding ? finding.percentage : 0;
                                const sev = finding ? finding.severity : 'NORMAL';
                                const style = pct === 0 ? 'bg-white border-green-200' : sev === 'HIGH' ? 'bg-red-50 border-red-300' : sev === 'MODERATE' ? 'bg-amber-50 border-amber-300' : 'bg-yellow-50 border-yellow-300';
                                const textStyle = pct === 0 ? 'text-green-600' : sev === 'HIGH' ? 'text-red-700' : 'text-amber-700';

                                return (
                                    <div key={diseaseType} className={`rounded-lg border ${style} p-3`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-slate-800 text-sm">{diseaseType}</h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/50 border">{sev}</span>
                                        </div>
                                        <p className={`text-2xl font-bold ${textStyle}`}>{pct.toFixed(2)}%</p>
                                        <p className="text-xs text-slate-500 mt-1 truncate">{finding ? finding.interpretation : 'Not Detected'}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {abnormalWBCs.length > 0 && (
                        <div className="px-6 py-6">
                            <h3 className="text-lg font-semibold text-slate-700 mb-4">Abnormal Cells Review</h3>
                            <div className="grid grid-cols-6 gap-2">
                                {abnormalWBCs.slice(0, 12).map((wbc, i) => (
                                    <div key={i} className="aspect-square bg-slate-100 rounded border overflow-hidden relative">
                                        {wbc.cropped_image ? (
                                            <img src={`data:image/png;base64,${wbc.cropped_image}`} className="w-full h-full object-cover" />
                                        ) : <div className="p-2 text-xs">No Img</div>}
                                        <div className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] truncate px-1">{wbc.classification}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: CELL COUNTS */}
            {activeTab === 'counts' && (
                <div>

                    <div className="hidden">
                        <div className={`px-6 py-6 border-l-4 ${getStatusStyle(patientStatus)}`}>
                            <div className="space-y-4">
                                {/* Main Status and WBC Count Row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-4xl shadow-sm rounded-full bg-white p-2">
                                            {patientStatus === 'Critical' ? (
                                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ) : patientStatus === 'Abnormal' ? (
                                                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium opacity-75">Overall Patient Status</p>
                                            <p className="text-3xl font-bold">{patientStatus || 'Normal'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm opacity-75">Total WBCs Counted</p>
                                        <p className="text-4xl font-bold">{totalWBC}</p>
                                    </div>
                                </div>

                                {/* Classification Summary Section - Enhanced with Click-to-Expand */}
                                <div className="bg-white/50 rounded-lg p-4 space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="font-semibold text-sm">Classification Summary (Across 10 Images)</h4>
                                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                                            Click cards for medical interpretation
                                        </span>
                                    </div>

                                    {/* Total Classified WBCs */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white rounded-lg p-3 border">
                                            <p className="text-xs opacity-75 mb-1">Classified WBCs</p>
                                            <p className="text-2xl font-bold text-blue-700">
                                                {wbcClassifications?.length || 0}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {totalWBC > 0 ? ((wbcClassifications?.length / totalWBC) * 100).toFixed(1) : 0}% of detected
                                            </p>
                                        </div>

                                        {/* Abnormal WBCs Count */}
                                        <div className="bg-white rounded-lg p-3 border border-amber-200">
                                            <p className="text-xs opacity-75 mb-1">Abnormal WBCs</p>
                                            <p className="text-2xl font-bold text-amber-700">
                                                {abnormalWBCs?.length || 0}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {wbcClassifications?.length > 0 ? ((abnormalWBCs?.length / wbcClassifications.length) * 100).toFixed(1) : 0}% abnormal
                                            </p>
                                        </div>

                                        {/* Sickle Cells Count */}
                                        <div className={`bg-white rounded-lg p-3 border ${sickleCell && sickleCell.count > 0 ? 'border-red-300' : 'border-green-200'
                                            }`}>
                                            <p className="text-xs opacity-75 mb-1">Sickle Cells</p>
                                            <p className={`text-2xl font-bold ${sickleCell && sickleCell.count > 0 ? 'text-red-700' : 'text-green-700'
                                                }`}>
                                                {sickleCell?.count || 0}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {sickleCell?.percentage?.toFixed(1) || 0}% of RBCs
                                            </p>
                                        </div>
                                    </div>

                                    {/* Disease Findings - Interactive Cards */}
                                    {diseaseFindings && diseaseFindings.length > 0 && (
                                        <div className="space-y-3 mt-4">
                                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                Detected Conditions
                                            </p>

                                            {diseaseFindings.map((finding, idx) => {
                                                const isExpanded = expandedDiseaseCard === `summary-${idx}`;

                                                // Get medical interpretation based on finding type
                                                const getMedicalInfo = () => {
                                                    const pct = finding.percentage || 0;
                                                    const type = finding.type || '';

                                                    if (type.includes('AML')) {
                                                        if (pct >= 20) return {
                                                            title: 'AML - Diagnostic Level',
                                                            interpretation: finding.interpretation,
                                                            action: 'IMMEDIATE REFERRAL: Urgent Hematology/Oncology admission required.',
                                                            clinicalNote: 'Finding of ≥20% blasts is diagnostic for Acute Leukemia. Perform rapid workup.',
                                                            reference: 'WHO criteria: ≥20% blasts in peripheral blood or bone marrow diagnostic for AML.',
                                                            color: 'red'
                                                        };
                                                        if (pct >= 10) return {
                                                            title: 'AML - Suspicious/High Risk',
                                                            interpretation: finding.interpretation,
                                                            action: 'URGENT REFERRAL: Hematology consultation within 24 hours.',
                                                            clinicalNote: 'High suspicion for emerging acute leukemia or MDS with excess blasts.',
                                                            reference: 'Blasts 10-19% suggest MDS with Excess Blasts-2 (MDS-EB-2) or evolving AML.',
                                                            color: 'amber'
                                                        };
                                                        return {
                                                            title: 'Blasts Detected - Monitor',
                                                            interpretation: finding.interpretation,
                                                            action: 'Review blood smear manually. Repeat CBC in 1 week.',
                                                            clinicalNote: 'Presence of circulating blasts is abnormal. Rule out physiological stress, infection, or sampling error.',
                                                            reference: 'Circulating blasts <5-10% may be seen in severe infection (leukemoid reaction) or G-CSF therapy.',
                                                            color: 'yellow'
                                                        };
                                                    }
                                                    if (type.includes('ALL')) {
                                                        if (pct >= 20) return {
                                                            title: 'ALL - Diagnostic Level',
                                                            interpretation: finding.interpretation,
                                                            action: 'IMMEDIATE REFERRAL: Urgent Hematology/Oncology admission required.',
                                                            clinicalNote: 'Finding of ≥20% lymphoblasts is diagnostic for Acute Lymphoblastic Leukemia.',
                                                            reference: 'WHO criteria: ≥20% lymphoblasts diagnostic for ALL.',
                                                            color: 'red'
                                                        };
                                                        if (pct >= 10) return {
                                                            title: 'ALL - Suspicious/High Risk',
                                                            interpretation: finding.interpretation,
                                                            action: 'URGENT REFERRAL: Hematology consultation within 24-48 hours.',
                                                            clinicalNote: 'Suspicious for lymphoproliferative disorder or viral etiology.',
                                                            reference: 'Distinguish from reactive atypical lymphocytes (mononucleosis) via flow cytometry.',
                                                            color: 'amber'
                                                        };
                                                        return {
                                                            title: 'Lymphoblasts Detected - Monitor',
                                                            interpretation: finding.interpretation,
                                                            action: 'Review smear. Correlate with viral symptoms.',
                                                            clinicalNote: 'Rule out viral infections (EBV, CMV) which can mimic blasts.',
                                                            reference: 'Clinical correlation essential.',
                                                            color: 'yellow'
                                                        };
                                                    }
                                                    if (type.includes('CML')) {
                                                        if (pct >= 50) return {
                                                            title: 'CML - Probable Accelerated/Blast Phase',
                                                            interpretation: finding.interpretation,
                                                            action: 'IMMEDIATE REFERRAL: Significant leukocytosis with left shift.',
                                                            clinicalNote: 'Risk of leukostasis. BCR-ABL1 testing mandatory.',
                                                            reference: 'Extreme granulocytosis with left shift strongly suggestive of CML or leukemoid reaction.',
                                                            color: 'red'
                                                        };
                                                        if (pct >= 20) return {
                                                            title: 'CML - Chronic Phase Likely',
                                                            interpretation: finding.interpretation,
                                                            action: 'REFERRAL: Hematology appointment for BCR-ABL1 testing.',
                                                            clinicalNote: 'Classic CML appearance (myelocyte bulge).',
                                                            reference: 'Presence of entire granulocytic series (myeloblast to neutrophil) suggests CML.',
                                                            color: 'amber'
                                                        };
                                                        return {
                                                            title: 'Granulocytic Left Shift',
                                                            interpretation: finding.interpretation,
                                                            action: 'Monitor. Rule out severe bacterial infection.',
                                                            clinicalNote: 'Left shift can be reactive (infection, inflammation) or early MPN.',
                                                            reference: 'Toxic granulation and Dohle bodies would suggest infection over CML.',
                                                            color: 'yellow'
                                                        };
                                                    }
                                                    if (type.includes('CLL')) {
                                                        if (pct >= 50) return {
                                                            title: 'CLL - Progressive/Advanced',
                                                            interpretation: finding.interpretation,
                                                            action: 'REFERRAL: Hematology consultation for staging.',
                                                            clinicalNote: 'Significant lymphocytosis. Assess for adenopathy/splenomegaly.',
                                                            reference: 'Persistent ALC >5000/uL with characteristic immunophenotype confirms CLL.',
                                                            color: 'red'
                                                        };
                                                        if (pct >= 20) return {
                                                            title: 'CLL - Typical',
                                                            interpretation: finding.interpretation,
                                                            action: 'Non-Urgent Referral. Monitor total lymphocyte count.',
                                                            clinicalNote: 'Common in elderly. "Smudge cells" often present (Albumin prep may reduce them).',
                                                            reference: 'Common incidental finding in older adults.',
                                                            color: 'amber'
                                                        };
                                                        return {
                                                            title: 'Lymphocytosis - Reactive vs Early CLL',
                                                            interpretation: finding.interpretation,
                                                            action: 'Repeat CBC in 4 weeks. Monitor.',
                                                            clinicalNote: 'Mild lymphocytosis is often viral.',
                                                            reference: 'Persistent lymphocytosis >3 months warrants investigation.',
                                                            color: 'yellow'
                                                        };
                                                    }
                                                    return {
                                                        title: finding.condition || finding.type,
                                                        interpretation: finding.interpretation,
                                                        action: 'Clinical correlation required.',
                                                        clinicalNote: 'Uncommon finding.',
                                                        reference: 'Consult hematology references.',
                                                        color: 'slate'
                                                    };
                                                };

                                                const medicalInfo = getMedicalInfo();

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setExpandedDiseaseCard(isExpanded ? null : `summary-${idx}`)}
                                                        className={`group relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden ${medicalInfo.color === 'red' ? 'bg-red-50/80 border-red-200 hover:border-red-400 hover:bg-red-50 hover:shadow-lg hover:shadow-red-900/10' :
                                                            medicalInfo.color === 'amber' ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-900/10' :
                                                                medicalInfo.color === 'yellow' ? 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg hover:shadow-yellow-900/10' :
                                                                    'bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-lg'
                                                            }`}
                                                    >
                                                        {/* Hover Tooltip for Quick Action */}
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                            <div className="bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                                                                Click for details & actions
                                                            </div>
                                                        </div>

                                                        {/* Main Card Content */}
                                                        <div className="p-4">
                                                            <div className="flex justify-between items-start gap-4">
                                                                <div className="flex-1">
                                                                    {/* Header with Severity Badge */}
                                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                        <h5 className="font-bold text-slate-800 text-base">{medicalInfo.title}</h5>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${finding.severity === 'HIGH' ? 'bg-red-500 text-white shadow-sm' :
                                                                            finding.severity === 'MODERATE' ? 'bg-amber-500 text-white shadow-sm' :
                                                                                finding.severity === 'LOW' ? 'bg-yellow-400 text-yellow-900' :
                                                                                    'bg-slate-400 text-white'
                                                                            }`}>
                                                                            {finding.severity}
                                                                        </span>
                                                                    </div>

                                                                    <p className="text-sm text-slate-700 leading-snug mb-3">
                                                                        {finding.interpretation}
                                                                    </p>

                                                                    {/* Action Preview (Visible when collapsed) */}
                                                                    {!isExpanded && (
                                                                        <div className={`text-xs font-semibold flex items-center gap-1 ${medicalInfo.color === 'red' ? 'text-red-700' :
                                                                            medicalInfo.color === 'amber' ? 'text-amber-700' :
                                                                                'text-slate-600'
                                                                            }`}>
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            Recommended Action: {medicalInfo.action}
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold mt-2 uppercase tracking-wide">
                                                                        <svg className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                        {isExpanded ? 'Collapse Details' : 'View Clinical Details'}
                                                                    </div>
                                                                </div>

                                                                <div className="text-right">
                                                                    <p className={`text-4xl font-black tracking-tight ${finding.severity === 'HIGH' ? 'text-red-600' :
                                                                        finding.severity === 'MODERATE' ? 'text-amber-600' :
                                                                            finding.severity === 'LOW' ? 'text-yellow-600' :
                                                                                'text-slate-600'
                                                                        }`}>
                                                                        {finding.percentage?.toFixed(1)}%
                                                                    </p>
                                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Confidence</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Expandable Medical Details */}
                                                        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                            <div className={`border-t bg-white p-5 ${medicalInfo.color === 'red' ? 'border-red-100' :
                                                                medicalInfo.color === 'amber' ? 'border-amber-100' :
                                                                    'border-slate-100'
                                                                }`}>
                                                                <div className="grid md:grid-cols-2 gap-4">
                                                                    {/* Action Column */}
                                                                    <div className="space-y-3">
                                                                        <div className={`p-3 rounded-lg border ${medicalInfo.color === 'red' ? 'bg-red-50 border-red-100' :
                                                                            medicalInfo.color === 'amber' ? 'bg-amber-50 border-amber-100' :
                                                                                'bg-blue-50 border-blue-100'
                                                                            }`}>
                                                                            <h6 className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${medicalInfo.color === 'red' ? 'text-red-800' : 'text-slate-700'
                                                                                }`}>
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                </svg>
                                                                                What to do
                                                                            </h6>
                                                                            <p className="text-sm font-medium text-slate-800">{medicalInfo.action}</p>
                                                                        </div>

                                                                        <div>
                                                                            <h6 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Clinical Note</h6>
                                                                            <p className="text-sm text-slate-700 leading-relaxed">{medicalInfo.clinicalNote}</p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Stats & Reference Column */}
                                                                    <div className="space-y-3">
                                                                        {/* Cell Breakdown */}
                                                                        {finding.breakdown && Object.keys(finding.breakdown).length > 0 && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cell Count Breakdown</p>
                                                                                <div className="grid grid-cols-2 gap-2">
                                                                                    {Object.entries(finding.breakdown)
                                                                                        .filter(([_, val]) => typeof val === 'number')
                                                                                        .map(([key, val]) => (
                                                                                            <div key={key} className="bg-white rounded border border-slate-100 p-2 flex justify-between items-center">
                                                                                                <span className="text-[10px] font-medium text-slate-500 truncate mr-2" title={key.replace(/CML:|CLL:|AML:|ALL:/g, '')}>
                                                                                                    {key.replace(/CML:|CLL:|AML:|ALL:/g, '').replace(/_/g, ' ')}
                                                                                                </span>
                                                                                                <span className="text-sm font-bold text-slate-800">{val}</span>
                                                                                            </div>
                                                                                        ))
                                                                                    }
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2">
                                                                            <span className="font-bold not-italic text-slate-500">Reference:</span> {medicalInfo.reference}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Disclaimer Footer */}
                                                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2">
                                                                    <svg className="w-4 h-4 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                    </svg>
                                                                    <p className="text-[10px] text-slate-500 leading-tight">
                                                                        <strong>AI Disclaimer:</strong> This analysis is computer-generated. All findings, especially those marked High/Critical,
                                                                        must be verified by manual microscopic review by a qualified professional.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Sickle Cell Analysis - Interactive Card */}
                                    {sickleCell && (() => {
                                        const pct = sickleCell.percentage || 0;
                                        const isExpanded = expandedSickleCell;

                                        const getSickleInfo = () => {
                                            if (pct >= 30) return {
                                                title: 'Severe Sickling (HbSS)',
                                                interpretation: `High confidence Sickle Cell Disease pattern (${pct.toFixed(1)}%).`,
                                                action: 'URGENT: Hematology evaluation. Assess for acute chest syndrome/vaso-occlusion.',
                                                clinicalNote: 'Microscopy shows irreversible sickled cells, targets, and polychromasia.',
                                                reference: 'Diagnostic for major sickle beta-globinopathy (HbSS).',
                                                severity: 'SEVERE'
                                            };
                                            if (pct >= 10) return {
                                                title: 'Moderate Sickling',
                                                interpretation: `Significant sickling present (${pct.toFixed(1)}%).`,
                                                action: 'Hematology referral for hemoglobin electrophoresis.',
                                                clinicalNote: 'Differential includes HbSC, HbS-Thal, or HbSS with high fetal hemoglobin.',
                                                reference: 'Further testing required to distinguish genotype.',
                                                severity: 'MODERATE'
                                            };
                                            if (pct >= 3) return {
                                                title: 'Mild Sickling / Trait',
                                                interpretation: `Occasional sickle forms detected (${pct.toFixed(1)}%).`,
                                                action: 'Routine follow-up. Genetic counseling if family planning.',
                                                clinicalNote: 'Likely Sickle Cell Trait (HbAS) or compound heterozygote.',
                                                reference: 'Usually asymptomatic under normal physiological conditions.',
                                                severity: 'MILD'
                                            };
                                            return {
                                                title: 'Normal RBC Morphology',
                                                interpretation: 'No sickling detected.',
                                                action: 'No action required regarding sickle cell.',
                                                clinicalNote: 'Normal red cell morphology observed.',
                                                reference: 'Normal.',
                                                severity: 'NORMAL'
                                            };
                                        };

                                        const sickleInfo = getSickleInfo();

                                        return (
                                            <div
                                                onClick={() => setExpandedSickleCell(!isExpanded)}
                                                className={`group relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden mt-3 ${pct >= 30 ? 'bg-red-50/80 border-red-200 hover:border-red-400 hover:shadow-lg' :
                                                    pct >= 10 ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:shadow-lg' :
                                                        pct >= 3 ? 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-400 hover:shadow-lg' :
                                                            'bg-slate-50 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                                                    }`}
                                            >
                                                {/* Hover Tooltip */}
                                                {pct >= 3 && (
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        <div className="bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                                                            Click for details
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="p-4">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                                                </svg>
                                                                <h5 className="font-bold text-slate-800 text-base">Sickle Cell Analysis</h5>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sickleCell.severity === 'SEVERE' ? 'bg-red-500 text-white' :
                                                                    sickleCell.severity === 'MODERATE' ? 'bg-amber-500 text-white' :
                                                                        sickleCell.severity === 'MILD' ? 'bg-yellow-400 text-yellow-900' :
                                                                            'bg-emerald-500 text-white'
                                                                    }`}>
                                                                    {sickleCell.severity || 'NORMAL'}
                                                                </span>
                                                            </div>

                                                            <p className="text-sm text-slate-700 leading-snug mb-3">
                                                                {sickleInfo.interpretation}
                                                            </p>

                                                            {!isExpanded && (
                                                                <p className="text-xs text-slate-500">
                                                                    <span className="font-mono font-semibold text-slate-700">{sickleCell.count}</span> sickle cells detected in <span className="font-mono font-semibold text-slate-700">{sickleCell.totalRBC}</span> RBCs
                                                                </p>
                                                            )}

                                                            <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold mt-2 uppercase tracking-wide">
                                                                <svg className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                                {isExpanded ? 'Collapse Details' : 'View Clinical Details'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-4xl font-black tracking-tight ${pct >= 30 ? 'text-red-600' :
                                                                pct >= 10 ? 'text-amber-600' :
                                                                    pct >= 3 ? 'text-yellow-600' :
                                                                        'text-emerald-600'
                                                                }`}>

                                                                {pct.toFixed(2)}%
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className={`border-t-2 bg-white ${pct >= 30 ? 'border-red-300' :
                                                        pct >= 10 ? 'border-amber-300' :
                                                            pct >= 3 ? 'border-yellow-300' :
                                                                'border-green-300'
                                                        }`}>
                                                        <div className={`px-4 py-2 ${pct >= 30 ? 'bg-red-600 text-white' :
                                                            pct >= 10 ? 'bg-amber-500 text-white' :
                                                                pct >= 3 ? 'bg-yellow-400 text-yellow-900' :
                                                                    'bg-green-600 text-white'
                                                            }`}>
                                                            <p className="text-sm font-bold">{sickleInfo.title}</p>
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Interpretation</p>
                                                                <p className="text-sm text-slate-700">{sickleInfo.interpretation}</p>
                                                            </div>
                                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    Clinical Recommendation
                                                                </p>
                                                                <p className="text-sm text-blue-800">{sickleInfo.clinicalNote}</p>
                                                            </div>
                                                            <div className="border-t border-slate-100 pt-2">
                                                                <p className="text-[10px] text-slate-400 italic">
                                                                    <span className="font-semibold not-italic text-slate-500">Reference:</span> {sickleInfo.reference}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* If no disease findings and no sickle cells */}
                                    {(!diseaseFindings || diseaseFindings.length === 0) &&
                                        (!sickleCell || sickleCell.count === 0) && (
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200 mt-3">
                                                <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    No significant disease markers detected. Results within normal thresholds.
                                                </p>
                                            </div>
                                        )}
                                </div>
                            </div>
                        </div>


                    </div>
                    {/* Cell Counts Summary */}
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-700 mb-3">Cell Count Summary</h3>

                        {/* Raw Detection Counts */}
                        <div className="mb-4">
                            <p className="text-sm text-slate-500 mb-2">Cells Detected (across 10 images)</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-slate-800">{totalWBC}</p>
                                    <p className="text-sm text-slate-600">WBC Detected</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-red-600">{totalRBC}</p>
                                    <p className="text-sm text-slate-600">RBC Detected</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-amber-600">{totalPlatelets}</p>
                                    <p className="text-sm text-slate-600">Platelets</p>
                                </div>
                            </div>
                        </div>

                        {/* Estimated Cell Counts */}
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <p className="text-sm font-medium text-blue-800 mb-3">Estimated Cell Counts (per µL)</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white rounded-lg p-3 border border-blue-100">
                                    <p className="text-2xl font-bold text-blue-700">
                                        {estimatedWBCCount?.toLocaleString() || 0}
                                    </p>
                                    <p className="text-sm text-blue-600">WBC/µL</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Formula: ({totalWBC} / 10) × 2,000
                                    </p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-blue-100">
                                    <p className="text-2xl font-bold text-red-600">
                                        {estimatedRBCCount?.toLocaleString() || 0}
                                    </p>
                                    <p className="text-sm text-red-500">RBC/µL</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Formula: ({avgRBCPerField?.toFixed(1) || 0} avg) × 200,000
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ConvNeXt Classification Breakdown */}
                    {aggregatedResults.classificationCounts && Object.keys(aggregatedResults.classificationCounts).length > 0 && (
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Classification Breakdown</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {Object.entries(aggregatedResults.classificationCounts)
                                    .sort((a, b) => b[1] - a[1]) // Sort by count descending
                                    .map(([className, count]) => {
                                        const catInfo = getClassificationCategory(className);
                                        const percentage = totalWBC > 0 ? ((count / totalWBC) * 100).toFixed(1) : 0;
                                        return (
                                            <div
                                                key={className}
                                                className={`p-2 rounded-lg border ${catInfo.color}`}
                                            >
                                                <p className="text-xs font-semibold truncate" title={catInfo.label}>
                                                    {catInfo.label}
                                                </p>
                                                <div className="flex justify-between items-baseline mt-1">
                                                    <span className="text-lg font-bold">{count}</span>
                                                    <span className="text-xs opacity-75">{percentage}%</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}

                    {/* WBC Differential - 5 Main Categories */}
                    {wbcDifferential && Object.keys(wbcDifferential).length > 0 && (
                        <div className="px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-700">WBC Differential</h3>

                                {/* Legend */}
                                <div className="flex items-center gap-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                        <span className="text-slate-600 font-medium">Low</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                        <span className="text-slate-600 font-medium">Normal</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                        <span className="text-slate-600 font-medium">High</span>
                                    </div>
                                    <span className="ml-2 text-slate-400 border-l border-slate-200 pl-3">
                                        Hover rows for detail
                                    </span>
                                </div>
                            </div>

                            {/* Header Row */}
                            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                                <div className="w-28">Cell Type</div>
                                <div className="flex-1">Distribution</div>
                                <div className="w-12 text-right">Count</div>
                                <div className="w-16 text-right">%</div>
                                <div className="w-24 text-right">Normal Range</div>
                                <div className="w-20 text-center">Status</div>
                            </div>

                            <div className="space-y-3">
                                {Object.entries(wbcDifferential).map(([name, data]) => {
                                    const analysis = getClinicalAnalysis(name, data.status);

                                    return (
                                        <div key={name} className="group relative">
                                            {/* Enhanced Hover Tooltip */}
                                            <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 bg-slate-800 text-white text-xs rounded-lg p-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                                                <p className="font-bold text-sm mb-2 border-b border-slate-600 pb-2 flex justify-between">
                                                    <span>{name}</span>
                                                    <span className={`${data.status === 'high' ? 'text-red-400' : data.status === 'low' ? 'text-blue-400' : 'text-green-400'}`}>
                                                        {data.status.toUpperCase()}
                                                    </span>
                                                </p>
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="font-semibold text-slate-400 text-[10px] uppercase mb-1">Interpretation</p>
                                                        <p className="leading-relaxed text-slate-200">{analysis.interpretation}</p>
                                                    </div>
                                                    <div className="bg-slate-700/50 p-2 rounded border-l-2 border-blue-400">
                                                        <p className="font-semibold text-blue-300 text-[10px] uppercase mb-1">Clinical Action</p>
                                                        <p className="leading-relaxed text-blue-100 italic">{analysis.recommendation}</p>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-700">
                                                        <span>Measurement: {data.count} cells ({data.percentage.toFixed(1)}%)</span>
                                                        <span>Ref: {data.normalRange}</span>
                                                    </div>
                                                </div>

                                                {/* Chevron/Arrow */}
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                                            </div>

                                            <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                                                <div className="w-28 text-sm font-medium text-slate-700">{name}</div>
                                                <div className="flex-1">
                                                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${data.status === 'high' ? 'bg-red-500' :
                                                                data.status === 'low' ? 'bg-blue-500' :
                                                                    'bg-green-500'
                                                                }`}
                                                            style={{ width: `${Math.min(100, data.percentage)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-12 text-right font-mono text-sm font-bold">{data.count}</div>
                                                <div className="w-16 text-right font-mono text-sm">{data.percentage.toFixed(1)}%</div>
                                                <div className="w-24 text-right text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                    {data.normalRange}
                                                </div>
                                                <div className={`w-20 text-center text-xs px-2 py-1 rounded font-medium border ${data.status === 'high' ? 'bg-red-50 text-red-700 border-red-100' :
                                                    data.status === 'low' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-green-50 text-green-700 border-green-100'
                                                    }`}>
                                                    {data.status === 'normal' ? 'Normal' : data.status === 'high' ? 'High' : 'Low'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                </div>
            )}
            {/* Actions */}
            <div className="px-6 py-4 bg-rose-50 flex gap-4 flex-wrap">
                <button
                    onClick={generatePDF}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print PDF Report
                </button>
                <button
                    onClick={() => {
                        console.log('Save Report button clicked, saveReport prop:', typeof saveReport);
                        if (typeof saveReport === 'function') {
                            saveReport();
                        } else {
                            console.error('saveReport is not a function:', saveReport);
                            alert('Error: Save Report function is not properly connected');
                        }
                    }}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Report
                </button>
                {/* Abnormal WBCs Button - Shows WBCs with disease markers (CML, CLL, ALL, AML) */}
                {abnormalWBCs && abnormalWBCs.length > 0 && (
                    <button
                        onClick={() => setShowAbnormalWBCs(!showAbnormalWBCs)}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {showAbnormalWBCs ? 'Hide' : 'Show'} Abnormal WBCs ({abnormalWBCs.length})
                    </button>
                )}
                <button
                    onClick={() => setShowWBCExamination(!showWBCExamination)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-800 text-white rounded-lg hover:bg-rose-900 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showWBCExamination ? 'Hide' : 'Show'} WBC Examination
                </button>
                <button
                    onClick={() => setShowRBCExamination(!showRBCExamination)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showRBCExamination ? 'Hide' : 'Show'} RBC/Sickle Cell Examination
                </button>
                <button
                    onClick={onReset}
                    className="px-4 py-2 bg-white border-2 border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 transition-colors font-medium text-sm"
                >
                    New Analysis
                </button>
            </div>

            {/* WBC Manual Examination Section */}
            {showWBCExamination && wbcClassifications && wbcClassifications.length > 0 && (
                <div className="border-t border-rose-200">
                    <div className="px-6 py-4 bg-rose-50">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-rose-900 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                WBC Manual Examination
                            </h3>
                            <p className="text-sm text-rose-600">
                                {filteredWBCs.length} of {wbcClassifications.length} cells shown
                            </p>
                        </div>

                        {/* Category Filter Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setWbcFilter('all')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'all' ? 'bg-red-700 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                    }`}
                            >
                                All ({wbcClassifications.length})
                            </button>
                            <button
                                onClick={() => setWbcFilter('abnormal')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'abnormal' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                    }`}
                            >
                                Abnormal ({wbcClassifications.length - categoryCounts['Normal']})
                            </button>
                            <button
                                onClick={() => setWbcFilter('Normal')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'Normal' ? 'bg-green-600 text-white' : 'bg-white text-green-700 hover:bg-green-100'
                                    }`}
                            >
                                Normal ({categoryCounts['Normal'] || 0})
                            </button>
                            {categoryCounts['AML'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('AML')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'AML' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                        }`}
                                >
                                    AML ({categoryCounts['AML']})
                                </button>
                            )}
                            {categoryCounts['ALL'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'ALL' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                        }`}
                                >
                                    ALL ({categoryCounts['ALL']})
                                </button>
                            )}
                            {categoryCounts['CML'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('CML')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'CML' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'
                                        }`}
                                >
                                    CML ({categoryCounts['CML']})
                                </button>
                            )}
                            {categoryCounts['CLL'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('CLL')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'CLL' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'
                                        }`}
                                >
                                    CLL ({categoryCounts['CLL']})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable WBC Grid */}
                    <div className="px-6 py-4 max-h-96 overflow-y-auto bg-white">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filteredWBCs.map((wbc, idx) => {
                                const catInfo = getClassificationCategory(wbc.classification);
                                return (
                                    <div
                                        key={wbc.wbc_id || idx}
                                        className={`rounded-lg border-2 overflow-hidden ${catInfo.color}`}
                                    >
                                        {/* Cell Image */}
                                        {wbc.cropped_image && (
                                            <div className="aspect-square bg-slate-100">
                                                <img
                                                    src={`data:image/png;base64,${wbc.cropped_image}`}
                                                    alt={wbc.classification}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}

                                        {/* Classification Label */}
                                        <div className="p-2 text-center">
                                            <p className="text-xs font-bold truncate" title={catInfo.label}>
                                                {catInfo.label}
                                            </p>
                                            <p className="text-xs opacity-75">
                                                {(wbc.confidence * 100).toFixed(0)}% conf
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {filteredWBCs.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                No cells match the selected filter
                            </div>
                        )}
                    </div>

                    {/* Classification Legend */}
                    <div className="px-6 py-3 bg-red-50 border-t border-red-200">
                        <p className="text-xs text-red-700 font-medium mb-2">Classification Legend (Based on About Page Thresholds):</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">AML/ALL: Blast cells (20% or more = Acute Leukemia)</span>
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">CML: Granulocytes (60% or more = CML indicators)</span>
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">CLL: Lymphocytes (40% or more = CLL indicators)</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Normal: Healthy WBC types</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Abnormal WBCs Examination Section - WBCs with disease markers not in 5 main categories */}
            {showAbnormalWBCs && abnormalWBCs && abnormalWBCs.length > 0 && (
                <div className="border-t border-amber-200">
                    <div className="px-6 py-4 bg-amber-50">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Abnormal WBCs for Review
                            </h3>
                            <p className="text-sm text-amber-700">
                                {abnormalWBCs.length} abnormal cells detected (non-Normal classifications)
                            </p>
                        </div>
                        <p className="text-xs text-amber-700 mb-3">
                            These WBCs have been classified with disease markers (CML, CLL, ALL, AML) and require further review.
                        </p>
                    </div>

                    {/* Abnormal WBCs Grid */}
                    <div className="px-6 py-4 max-h-96 overflow-y-auto bg-white">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {abnormalWBCs.map((wbc, idx) => {
                                const catInfo = getClassificationCategory(wbc.classification);
                                return (
                                    <div
                                        key={wbc.wbc_id || `abnormal-${idx}`}
                                        className={`rounded-lg border-2 overflow-hidden ${catInfo.color}`}
                                    >
                                        {/* Cell Image */}
                                        {wbc.cropped_image && (
                                            <div className="aspect-square bg-slate-100">
                                                <img
                                                    src={`data:image/png;base64,${wbc.cropped_image}`}
                                                    alt={wbc.classification}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}

                                        {/* Classification Label */}
                                        <div className="p-2 text-center">
                                            <p className="text-xs font-bold truncate" title={wbc.classification}>
                                                {wbc.classification}
                                            </p>
                                            <p className="text-xs opacity-75">
                                                {(wbc.confidence * 100).toFixed(0)}% conf
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Abnormal WBCs Legend */}
                    <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
                        <p className="text-xs text-amber-700 font-medium mb-2">Disease Markers Detected:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">AML: Acute Myeloid Leukemia</span>
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">ALL: Acute Lymphoblastic Leukemia</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">CML: Chronic Myeloid Leukemia</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">CLL: Chronic Lymphocytic Leukemia</span>
                        </div>
                    </div>
                </div>
            )}

            {/* RBC/Sickle Cell Manual Examination Section */}
            {showRBCExamination && aggregatedResults.rbcClassifications && aggregatedResults.rbcClassifications.length > 0 && (
                <div className="border-t border-slate-200">
                    {/* RBC Section Header */}
                    <div className="px-6 py-3 bg-red-50 border-b border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            RBC/Sickle Cell Manual Examination
                            <span className="text-sm font-normal text-slate-600">
                                ({aggregatedResults.rbcClassifications.length} RBC cells detected)
                            </span>
                        </h3>
                    </div>

                    {/* RBC Filter Buttons */}
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2">
                        <button
                            onClick={() => setRbcFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${rbcFilter === 'all'
                                ? 'bg-slate-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                                }`}
                        >
                            All RBCs ({aggregatedResults.rbcClassifications.length})
                        </button>
                        <button
                            onClick={() => setRbcFilter('sickle')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${rbcFilter === 'sickle'
                                ? 'bg-red-600 text-white'
                                : 'bg-white text-red-600 border border-red-300 hover:bg-red-50'
                                }`}
                        >
                            Sickle Cells Only ({aggregatedResults.rbcClassifications.filter(rbc => rbc.is_abnormal).length})
                        </button>
                        <button
                            onClick={() => setRbcFilter('normal')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${rbcFilter === 'normal'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-green-600 border border-green-300 hover:bg-green-50'
                                }`}
                        >
                            Normal RBCs ({aggregatedResults.rbcClassifications.filter(rbc => !rbc.is_abnormal).length})
                        </button>
                    </div>

                    {/* RBC Cells Scrollable Grid */}
                    <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                            {aggregatedResults.rbcClassifications
                                .filter(rbc => {
                                    if (rbcFilter === 'all') return true;
                                    if (rbcFilter === 'sickle') return rbc.is_abnormal;
                                    if (rbcFilter === 'normal') return !rbc.is_abnormal;
                                    return true;
                                })
                                .map((rbc, idx) => {
                                    const isSickle = rbc.is_abnormal;
                                    const borderColor = isSickle ? 'border-red-500' : 'border-green-500';
                                    const label = isSickle ? 'Sickle Cell' : 'Normal RBC';

                                    return (
                                        <div
                                            key={rbc.rbc_id || idx}
                                            className={`rounded-lg border-2 overflow-hidden ${borderColor}`}
                                        >
                                            {/* Cell Image */}
                                            {rbc.cropped_image && (
                                                <div className="aspect-square bg-slate-100">
                                                    <img
                                                        src={`data:image/png;base64,${rbc.cropped_image}`}
                                                        alt={label}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* Classification Label */}
                                            <div className="p-2 text-center">
                                                <p className={`text-xs font-bold truncate ${isSickle ? 'text-red-800' : 'text-green-800'}`} title={label}>
                                                    {label}
                                                </p>
                                                {rbc.confidence && (
                                                    <p className="text-xs opacity-75">
                                                        {(rbc.confidence * 100).toFixed(0)}% conf
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {aggregatedResults.rbcClassifications.filter(rbc => {
                            if (rbcFilter === 'all') return true;
                            if (rbcFilter === 'sickle') return rbc.is_abnormal;
                            if (rbcFilter === 'normal') return !rbc.is_abnormal;
                            return true;
                        }).length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                    No cells match the selected filter
                                </div>
                            )}
                    </div>

                    {/* Sickle Cell Threshold Legend */}
                    <div className="px-6 py-3 bg-red-50 border-t border-slate-200">
                        <p className="text-xs text-slate-600 font-medium mb-2">Sickle Cell Thresholds (Based on About Page):</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">&lt;3%: Normal</span>
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">3-10%: Mild (HbAS)</span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">10-30%: Moderate</span>
                            <span className="px-2 py-1 bg-red-200 text-red-900 rounded font-bold">&gt;30%: Severe (HbSS)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            <strong>Current Sickle Cell Percentage:</strong> {aggregatedResults.sickleCell.percentage.toFixed(2)}%
                            ({aggregatedResults.sickleCell.count} sickle cells / {aggregatedResults.totalRBC} total RBCs)
                        </p>
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                    <strong>Clinical Disclaimer:</strong> This analysis is for research and educational purposes.
                    Results should be verified by a qualified hematologist. Additional diagnostic tests may be required.
                </p>
            </div>
        </div>
    );
};

export default FinalResults;
