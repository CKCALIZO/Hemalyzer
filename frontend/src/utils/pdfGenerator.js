import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generatePDF = (report) => {
    if (!report) return;
    const doc = new jsPDF();

    // --- Helper for Disease-Based Clinical Recommendations ---
    const getDiseaseRecommendations = (diseaseFindings, sickleCell) => {
        const recommendations = [];

        // diseaseFindings is an array of disease objects
        if (diseaseFindings && Array.isArray(diseaseFindings)) {
            diseaseFindings.forEach(finding => {
                if (finding.recommendation) {
                    // Use the pre-computed recommendation from AnalysisContext
                    const severity = finding.severity || 'NORMAL';
                    const prefix = severity === 'HIGH' ? '⚠️ ' : severity === 'MODERATE' ? '⚡ ' : '';
                    recommendations.push(`${prefix}${finding.condition || finding.type}: ${finding.recommendation}`);
                } else if (finding.severity && finding.severity !== 'NORMAL') {
                    // Fallback: Generate recommendation based on disease type and severity
                    const type = finding.type || '';
                    const pct = finding.percentage ? finding.percentage.toFixed(1) : '0';

                    if (type.includes('AML') || type.includes('ALL')) {
                        if (finding.severity === 'HIGH') {
                            recommendations.push(`Acute Leukemia (${pct}% blasts): Immediate hematologist referral. Bone marrow biopsy and cytogenetic testing recommended.`);
                        } else if (finding.severity === 'MODERATE') {
                            recommendations.push(`Suspicious Blasts (${pct}%): Close monitoring advised. Repeat CBC in 1-2 weeks.`);
                        }
                    } else if (type.includes('CML')) {
                        if (finding.severity === 'HIGH') {
                            recommendations.push(`CML Detected (${pct}%): BCR-ABL testing required. Tyrosine kinase inhibitor therapy evaluation advised.`);
                        } else if (finding.severity === 'MODERATE') {
                            recommendations.push(`Early CML Pattern (${pct}%): Confirm with BCR-ABL testing. Monitor WBC trend. Follow-up in 2-4 weeks.`);
                        }
                    } else if (type.includes('CLL')) {
                        if (finding.severity === 'HIGH') {
                            recommendations.push(`CLL Detected (${pct}%): Immunophenotyping recommended. Regular monitoring every 3-6 months.`);
                        } else if (finding.severity === 'MODERATE') {
                            recommendations.push(`Early CLL Pattern (${pct}%): Observe and monitor. Repeat CBC in 3 months.`);
                        }
                    }
                }
            });
        }

        // Sickle Cell Analysis
        if (sickleCell && sickleCell.percentage !== undefined && sickleCell.percentage >= 3) {
            if (sickleCell.recommendation) {
                recommendations.push(`Sickle Cell: ${sickleCell.recommendation}`);
            } else {
                const sicklePct = sickleCell.percentage;
                if (sicklePct > 30) {
                    recommendations.push("Severe Sickle Cell Disease (HbSS): Comprehensive management required. Hydroxyurea therapy evaluation. Pain management protocols advised.");
                } else if (sicklePct >= 10) {
                    recommendations.push("Moderate Sickling: Hemoglobin electrophoresis recommended. Avoid dehydration. Regular follow-up advised.");
                } else if (sicklePct >= 3) {
                    recommendations.push("Sickle Cell Trait (HbAS): Genetic counseling recommended. Avoid extreme exertion and altitude.");
                }
            }
        }

        // Default if no significant findings
        if (recommendations.length === 0) {
            return "Blood parameters within normal limits. No significant hematological abnormalities detected. Continue routine health monitoring.";
        }

        return recommendations.join(" | ");
    };

    doc.setFillColor(255, 0, 0); // Sets the color to pure red
    doc.rect(0, 0, 210, 4, 'F');

    // Lab/App Info
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 0, 0); // Dark Red
    doc.text("HEMALYZER", 15, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Automated PBS Analysis System", 15, 26);
    doc.text("Report Generated:", 150, 20);
    doc.text(report.timestamp, 150, 26);

    // --- Patient Info Grid ---
    let y = 35;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 30, 195, 30); // Separator line

    const pd = report.patientData || {};

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Row 1
    doc.setFont("helvetica", "bold"); doc.text("Patient Name:", 15, y);
    doc.setFont("helvetica", "normal"); doc.text(pd.name || "N/A", 45, y);

    doc.setFont("helvetica", "bold"); doc.text("Age / Gender:", 110, y);
    doc.setFont("helvetica", "normal"); doc.text(`${pd.age || '--'} Yrs / ${pd.gender || '--'}`, 140, y);

    y += 8;
    // Row 2
    doc.setFont("helvetica", "bold"); doc.text("MRN:", 15, y);
    doc.setFont("helvetica", "normal"); doc.text(pd.id || "N/A", 45, y);

    doc.setFont("helvetica", "bold"); doc.text("Ref. By:", 110, y);
    doc.setFont("helvetica", "normal"); doc.text("Self-Referral", 140, y); // Placeholder/Default

    y += 15;

    // --- Main Title ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 0, 0); // Dark Red
    doc.text("HEMALYZER ANALYSIS", 105, y, { align: 'center' });
    y += 10;

    // --- Results Table ---
    // Prepare Data
    const tableData = [];

    // 1. RBC
    // Note: EstimatedRBC is in total count. For M/uL we divide by 1e6
    const rbcVal = report.summary && report.summary.estimatedRBCCount
        ? (report.summary.estimatedRBCCount / 1000000).toFixed(2)
        : (report.data.stage1_detection?.counts?.RBC ? "Undetected" : "-");

    tableData.push(["RBC Count", rbcVal, "4.5 - 5.5", "mill/cumm"]);

    // 2. WBC Total
    const wbcVal = report.summary && report.summary.estimatedWBCCount
        ? report.summary.estimatedWBCCount.toLocaleString()
        : "-";
    tableData.push(["Total WBC Count", wbcVal, "4000 - 11000", "cumm"]);

    // 3. Platelets (Reference Hidden as requested)
    const pltVal = report.summary && report.summary.plateletCount
        ? report.summary.plateletCount // This is raw count from image, not estimated per uL unless formula applied
        : "-";
    // NOTE: If we want estimated platelets, we need that property. Assuming 'plateletCount' is raw or est?
    // In FinalResults it says raw count. But user asked for "reference count remove".
    // I will show the value, and leave Reference column EMPTY for Platelets.
    tableData.push(["Platelet Count", pltVal, "", "cumm"]);

    // 4. Differential Header Row (Manual push to act as section header)
    tableData.push([{ content: "DIFFERENTIAL WBC COUNT", colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);

    // 5. Differential Rows
    if (report.data && report.data.wbcDifferential) {
        Object.entries(report.data.wbcDifferential).forEach(([cell, data]) => {
            let refRange = "";
            if (cell === "Neutrophil") refRange = "40 - 75";
            if (cell === "Lymphocyte") refRange = "20 - 45";
            if (cell === "Monocyte") refRange = "2 - 10";
            if (cell === "Eosinophil") refRange = "1 - 6";
            if (cell === "Basophil") refRange = "0 - 1";

            tableData.push([
                cell + "s",
                data.percentage ? data.percentage.toFixed(1) : "0",
                refRange,
                "%"
            ]);
        });
    }

    autoTable(doc, {
        startY: y,
        head: [['Investigation', 'Result', 'Reference Value', 'Unit']],
        body: tableData,
        theme: 'plain',

        // Styles to match Drlogy / clean look
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0,
            borderBottomWidth: 1.5,
            borderColor: [200, 200, 200]
        },
        styles: {
            fontSize: 10,
            cellPadding: 4,
            textColor: [50, 50, 50]
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 }, // Investigation
            1: { fontStyle: 'bold', textColor: [30, 58, 138] }, // Result (Blue)
            2: { textColor: [80, 80, 80] }, // Ref Value
            3: { textColor: [80, 80, 80] }  // Unit
        },
        didParseCell: function (data) {
            // Optional customization
        }
    });

    y = doc.lastAutoTable.finalY + 15;

    // --- Clinical Recommendations (Disease-Based) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(139, 0, 0); // Dark Red
    doc.text("Clinical Recommendations:", 15, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const recommendationText = getDiseaseRecommendations(report.data.diseaseFindings || {}, report.data.sickleCell || {});
    const splitText = doc.splitTextToSize(recommendationText, 180);
    doc.text(splitText, 15, y);

    y += splitText.length * 4 + 10;

    // --- Footer / Disclaimer ---
    // Position at bottom
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, pageHeight - 20, 195, pageHeight - 20);

    doc.text("Clinical Disclaimer: This report is generated by AI (Hemalyzer) for RESEARCH PURPOSES ONLY.", 105, pageHeight - 15, { align: 'center' });
    doc.text("It is not a definitive medical diagnosis. Confirmatory testing is required.", 105, pageHeight - 11, { align: 'center' });
    doc.text("**** End of Report ****", 105, pageHeight - 6, { align: 'center' });

    // Generate filename using patient MRN and name
    const patientMRN = report.patientData?.id || 'UNKNOWN';
    const patientName = report.patientData?.name ? report.patientData.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Unknown_Patient';
    const filename = `Hemalyzer_${patientName}_${patientMRN}.pdf`;
    
    doc.save(filename);
};
