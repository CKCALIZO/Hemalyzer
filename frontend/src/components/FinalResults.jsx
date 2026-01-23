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
    onReset 
}) => {
    const navigate = useNavigate();
    const [showWBCExamination, setShowWBCExamination] = useState(false);
    const [showRBCExamination, setShowRBCExamination] = useState(false);
    const [showAbnormalWBCs, setShowAbnormalWBCs] = useState(false);
    const [wbcFilter, setWbcFilter] = useState('all');
    const [rbcFilter, setRbcFilter] = useState('all');
    
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

    // Save report to localStorage
    const saveReport = () => {
        const reports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        const newReport = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            data: aggregatedResults,
            imagesCount: processedImages.length
        };
        
        reports.unshift(newReport);
        localStorage.setItem('hemalyzer_reports', JSON.stringify(reports));
        
        alert('Report saved successfully!');
        navigate('/reports');
    };

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

        // Footer / Disclaimer
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 2, 2, 'F');
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("CLINICAL DISCLAIMER", margin + 5, yPos + 8);
        doc.setFont("helvetica", "normal");
        const disclaimer = "This report is generated by an automated blood cell analysis system for research and educational purposes. Results should be verified by a qualified hematologist. Additional diagnostic tests may be required for confirmation.";
        const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin - 10);
        doc.text(splitDisclaimer, margin + 5, yPos + 15);

        // Save the PDF
        const fileName = `Hemalyzer_Report_${new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="bg-white rounded-lg border-2 border-slate-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🔬</span>
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

            {/* Patient Status Banner */}
            <div className={`px-6 py-4 border-l-4 ${getStatusStyle(patientStatus)}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{getStatusIcon(patientStatus)}</span>
                        <div>
                            <p className="text-sm font-medium opacity-75">Overall Patient Status</p>
                            <p className="text-2xl font-bold">{patientStatus || 'Normal'}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm opacity-75">Total WBCs Counted</p>
                        <p className="text-3xl font-bold">{totalWBC}</p>
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
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">ConvNeXt Classification Breakdown</h3>
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
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">WBC Differential (5 Main Categories)</h3>
                    <p className="text-xs text-slate-500 mb-3">
                        Cells are categorized by type regardless of condition (e.g., "Basophil: CML" counts as Basophil)
                    </p>
                    <div className="space-y-3">
                        {Object.entries(wbcDifferential).map(([name, data]) => (
                            <div key={name} className="flex items-center gap-4">
                                <div className="w-28 text-sm font-medium text-slate-700">{name}</div>
                                <div className="flex-1">
                                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${
                                                data.status === 'high' ? 'bg-red-500' :
                                                data.status === 'low' ? 'bg-blue-500' :
                                                'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(100, data.percentage)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="w-12 text-right font-mono text-sm font-bold">{data.count}</div>
                                <div className="w-16 text-right font-mono text-sm">{data.percentage.toFixed(1)}%</div>
                                <div className="w-20 text-right text-xs text-slate-500">{data.normalRange}</div>
                                <div className={`w-16 text-center text-xs px-2 py-1 rounded font-medium ${
                                    data.status === 'high' ? 'bg-red-100 text-red-700' :
                                    data.status === 'low' ? 'bg-blue-100 text-blue-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                    {data.status === 'normal' ? 'Normal' : data.status === 'high' ? 'High' : 'Low'}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Normal Value Reference */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-slate-600 mb-2">Normal Value Thresholds:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-white rounded border border-slate-200">Neutrophil: 45-65%</span>
                            <span className="px-2 py-1 bg-white rounded border border-slate-200">Lymphocyte: 20-35%</span>
                            <span className="px-2 py-1 bg-white rounded border border-slate-200">Monocyte: 2-6%</span>
                            <span className="px-2 py-1 bg-white rounded border border-slate-200">Eosinophil: 2-4%</span>
                            <span className="px-2 py-1 bg-white rounded border border-slate-200">Basophil: 0-1%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Disease Findings */}
            {diseaseFindings && diseaseFindings.length > 0 && (
                <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Disease Analysis</h3>
                    <div className="space-y-3">
                        {diseaseFindings.map((finding, idx) => (
                            <div 
                                key={idx} 
                                className={`p-4 rounded-lg border-l-4 ${
                                    finding.severity === 'HIGH' ? 'bg-red-50 border-red-500' :
                                    finding.severity === 'MODERATE' ? 'bg-amber-50 border-amber-500' :
                                    finding.severity === 'LOW' ? 'bg-yellow-50 border-yellow-500' :
                                    'bg-slate-50 border-slate-400'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-slate-800">{finding.type}</p>
                                        <p className="text-sm text-slate-600 mt-1">{finding.interpretation}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold">{finding.percentage?.toFixed(1)}%</p>
                                        <p className={`text-xs px-2 py-1 rounded ${
                                            finding.severity === 'HIGH' ? 'bg-red-200 text-red-800' :
                                            finding.severity === 'MODERATE' ? 'bg-amber-200 text-amber-800' :
                                            'bg-slate-200 text-slate-800'
                                        }`}>{finding.severity}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sickle Cell Analysis */}
            {sickleCell && sickleCell.count > 0 && (
                <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Sickle Cell Analysis</h3>
                    <div className={`p-4 rounded-lg border-l-4 ${
                        sickleCell.percentage > 30 ? 'bg-red-50 border-red-500' :
                        sickleCell.percentage >= 10 ? 'bg-amber-50 border-amber-500' :
                        sickleCell.percentage >= 3 ? 'bg-yellow-50 border-yellow-500' :
                        'bg-green-50 border-green-500'
                    }`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{sickleCell.interpretation}</p>
                                <p className="text-sm text-slate-600">
                                    {sickleCell.count} sickle cells / {sickleCell.totalRBC} RBCs analyzed
                                </p>
                                <p className={`text-xs mt-1 px-2 py-1 rounded inline-block ${
                                    sickleCell.severity === 'SEVERE' ? 'bg-red-200 text-red-800' :
                                    sickleCell.severity === 'MODERATE' ? 'bg-amber-200 text-amber-800' :
                                    sickleCell.severity === 'MILD' ? 'bg-yellow-200 text-yellow-800' :
                                    'bg-green-200 text-green-800'
                                }`}>{sickleCell.severity || 'NORMAL'}</p>
                            </div>
                            <p className="text-2xl font-bold">{sickleCell.percentage?.toFixed(2)}%</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="px-6 py-4 bg-red-50 flex gap-4 flex-wrap">
                <button
                    onClick={generatePDF}
                    className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-semibold"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print PDF Report
                </button>
                <button
                    onClick={saveReport}
                    className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
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
                        className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {showAbnormalWBCs ? 'Hide' : 'Show'} Abnormal WBCs ({abnormalWBCs.length})
                    </button>
                )}
                <button
                    onClick={() => setShowWBCExamination(!showWBCExamination)}
                    className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors font-semibold"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showWBCExamination ? 'Hide' : 'Show'} WBC Examination
                </button>
                <button
                    onClick={() => setShowRBCExamination(!showRBCExamination)}
                    className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showRBCExamination ? 'Hide' : 'Show'} RBC/Sickle Cell Examination
                </button>
                <button
                    onClick={onReset}
                    className="px-6 py-3 bg-white border-2 border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-semibold"
                >
                    New Analysis
                </button>
            </div>

            {/* WBC Manual Examination Section */}
            {showWBCExamination && wbcClassifications && wbcClassifications.length > 0 && (
                <div className="border-t border-red-200">
                    <div className="px-6 py-4 bg-red-50">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-red-900 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                WBC Manual Examination
                            </h3>
                            <p className="text-sm text-red-600">
                                {filteredWBCs.length} of {wbcClassifications.length} cells shown
                            </p>
                        </div>
                        
                        {/* Category Filter Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setWbcFilter('all')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                    wbcFilter === 'all' ? 'bg-red-700 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                }`}
                            >
                                All ({wbcClassifications.length})
                            </button>
                            <button
                                onClick={() => setWbcFilter('abnormal')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                    wbcFilter === 'abnormal' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                }`}
                            >
                                Abnormal ({wbcClassifications.length - categoryCounts['Normal']})
                            </button>
                            <button
                                onClick={() => setWbcFilter('Normal')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                    wbcFilter === 'Normal' ? 'bg-green-600 text-white' : 'bg-white text-green-700 hover:bg-green-100'
                                }`}
                            >
                                Normal ({categoryCounts['Normal'] || 0})
                            </button>
                            {categoryCounts['AML'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('AML')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        wbcFilter === 'AML' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                    }`}
                                >
                                    AML ({categoryCounts['AML']})
                                </button>
                            )}
                            {categoryCounts['ALL'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        wbcFilter === 'ALL' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                    }`}
                                >
                                    ALL ({categoryCounts['ALL']})
                                </button>
                            )}
                            {categoryCounts['CML'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('CML')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        wbcFilter === 'CML' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'
                                    }`}
                                >
                                    CML ({categoryCounts['CML']})
                                </button>
                            )}
                            {categoryCounts['CLL'] > 0 && (
                                <button
                                    onClick={() => setWbcFilter('CLL')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        wbcFilter === 'CLL' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'
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
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                rbcFilter === 'all' 
                                    ? 'bg-slate-600 text-white' 
                                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                            All RBCs ({aggregatedResults.rbcClassifications.length})
                        </button>
                        <button
                            onClick={() => setRbcFilter('sickle')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                rbcFilter === 'sickle' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-white text-red-600 border border-red-300 hover:bg-red-50'
                            }`}
                        >
                            Sickle Cells Only ({aggregatedResults.rbcClassifications.filter(rbc => rbc.is_abnormal).length})
                        </button>
                        <button
                            onClick={() => setRbcFilter('normal')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                rbcFilter === 'normal' 
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
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">&lt;0.3%: Normal</span>
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">0.4-0.6%: Minimal Sickling</span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">0.7-1.0%: Sickle Cell Trait</span>
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">1.1-1.5%: Sickle Cell Disease</span>
                            <span className="px-2 py-1 bg-red-200 text-red-900 rounded font-bold">≥1.6%: Severe Sickle Cell Disease</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            <strong>Current Sickle Cell Percentage:</strong> {aggregatedResults.sickleCell.percentage}% 
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
