import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generatePDF = (report) => {
    if (!report) return;
    const doc = new jsPDF();

    // --- Helper for Threshold-Based Classification Interpretation ---
    const getDiseaseRecommendations = (diseaseFindings, sickleCell) => {
        const abnormalLines = [];
        const normalDiseases = [];

        // diseaseFindings is an array of disease objects
        if (diseaseFindings && Array.isArray(diseaseFindings)) {
            diseaseFindings.forEach(finding => {
                const severity = finding.severity || 'NORMAL';
                // Use type for label to avoid repetitive condition text
                // Clean up type to remove parenthesis explanation for cleaner list
                const fullType = finding.type || 'Unknown';
                const label = fullType.split('(')[0].trim();  

                if (severity === 'NORMAL' || severity === 'BELOW_THRESHOLD') {
                    // Collect below-threshold diseases for a single grouped line
                    normalDiseases.push(label);
                    return;
                }

                // Above threshold: show which threshold was met
                if (finding.recommendation) {
                    // Use the custom recommendation generated in AnalysisContext
                    // Clean it up if it repeats the type name
                    abnormalLines.push(`- ${label}: ${finding.recommendation}`);
                } else {
                    // Fallback should rarely be reached now as AnalysisContext generates recommendations
                    const pct = finding.percentage ? finding.percentage.toFixed(1) : '0';
                    abnormalLines.push(`- ${label} (${pct}%): Threshold met.`);
                }
            });
        }

        // Sickle Cell Analysis
        if (sickleCell && sickleCell.percentage !== undefined && sickleCell.percentage >= 3) {
            if (sickleCell.recommendation) {
                abnormalLines.push(`- Sickle Cell: ${sickleCell.recommendation}`);
            } else {
                const sicklePct = sickleCell.percentage;
                if (sicklePct > 30) {
                    abnormalLines.push(`- Severe Sickling (${sicklePct.toFixed(1)}%): HbSS classification threshold met (> 30% sickled cells).`);
                } else if (sicklePct >= 10) {
                    abnormalLines.push(`- Moderate Sickling (${sicklePct.toFixed(1)}%): Above moderate threshold (10-30% sickled cells).`);
                } else if (sicklePct >= 3) {
                    abnormalLines.push(`- Sickle Cell Trait (${sicklePct.toFixed(1)}%): HbAS threshold met (3-10% sickled cells).`);
                }
            }
        }

        // Build final output
        const lines = [];

        if (abnormalLines.length > 0) {
            abnormalLines.forEach(line => lines.push(line));
        }

        if (normalDiseases.length > 0) {
            lines.push(`Below Threshold: ${normalDiseases.join(', ')}. Within normal classification range.`);
        }

        // Default if no findings at all
        if (lines.length === 0) {
            return "All classification parameters within normal range. No classification thresholds met for any disease type.";
        }

        return lines.join("\n");
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

    // 4. Classification Header Row
    tableData.push([{ content: "WBC CLASSIFICATION", colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);

    // 5. Classification Rows (Normal vs Disease)
    if (report.data && report.data.classificationCounts) {
        // Sort by count descending
        const sortedEntries = Object.entries(report.data.classificationCounts)
            .sort(([, countA], [, countB]) => countB - countA);
            
        sortedEntries.forEach(([className, count]) => {
            const totalWBC = report.summary?.wbcCount || 1;
            const pct = ((count / totalWBC) * 100).toFixed(1);
            
            // Map long internal names to shorter display names if needed
            let displayName = className;
            if (className === 'Acute Lymphoblastic Leukemia') displayName = 'ALL';
            if (className === 'Acute Myeloid Leukemia') displayName = 'AML';
            if (className === 'Chronic Myeloid Leukemia') displayName = 'CML';
            if (className === 'Chronic Lymphocytic Leukemia') displayName = 'CLL';
            if (className === 'Sickle Cell Anemia') displayName = 'Sickle Cell';

            tableData.push([
                displayName,
                pct,
                "",  // No reference value for classification counts
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

    // --- Threshold Interpretation ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(139, 0, 0); // Dark Red
    doc.text("Classification Results & Threshold Interpretation:", 15, y);
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

    doc.text("Disclaimer: This report is generated by AI (Hemalyzer) for RESEARCH and EDUCATIONAL PURPOSES ONLY.", 105, pageHeight - 15, { align: 'center' });
    doc.text("It is not a medical diagnosis. Confirmatory testing is required.", 105, pageHeight - 11, { align: 'center' });
    doc.text("**** End of Report ****", 105, pageHeight - 6, { align: 'center' });

    // Generate filename using patient MRN and name
    const patientMRN = report.patientData?.id || 'UNKNOWN';
    const patientName = report.patientData?.name ? report.patientData.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Unknown_Patient';
    const filename = `Hemalyzer_${patientName}_${patientMRN}.pdf`;

    doc.save(filename);
};
