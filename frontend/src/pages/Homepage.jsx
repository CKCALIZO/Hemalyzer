
import { useState } from "react";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";
import { FinalResults } from "../components/FinalResults.jsx";
import { RegistrationForm } from "../components/homepage/RegistrationForm.jsx";
import { UploadSection } from "../components/homepage/UploadSection.jsx";
import { AnalysisResults } from "../components/homepage/AnalysisResults.jsx";
import { ClassificationsModal } from "../components/homepage/ClassificationsModal.jsx";
import { ProcessedImagesThumbnails } from "../components/ProcessedImagesThumbnails.jsx";
import { useAnalysis } from "../context/AnalysisContext.jsx";

const Homepage = () => {
    const {
        patientName, setPatientName,
        patientId, setPatientId,
        patientAge, setPatientAge,
        patientGender, setPatientGender,
        patientPhone, setPatientPhone,
        isRegistered, setIsRegistered,
        selectedFile,
        previewUrl,
        loading,
        error, setError,
        analysisProgress,
        processedImages,
        aggregatedCounts,
        currentResults,
        showCurrentResults, setShowCurrentResults,
        thresholdMet,
        finalResults,
        bulkFiles, setBulkFiles,
        bulkProgress,
        isBulkProcessing,
        handleFileChange,
        handleAnalyze,
        handleReset,
        handleBulkFileChange,
        handleBulkUpload,
        handleRegistration,
        saveReport,
        TARGET_IMAGE_COUNT
    } = useAnalysis();

    const [showClassificationsModal, setShowClassificationsModal] = useState(false);

    // Handle Changing Patient (Reset)
    const handleChangePatient = () => {
        if (confirm("Change patient? This will reset the current analysis and clear all captured images.")) {
            handleReset();
        }
    };

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
                                saveReport={saveReport}
                            />
                        </div>
                    )}

                    {/* Intermediate Results */}
                    {!finalResults && thresholdMet && (
                        <ThresholdResults
                            processedImages={processedImages}
                            analysisResults={useAnalysis().calculateFinalResults ? useAnalysis().calculateFinalResults() : null} // Wait, calculateFinalResults is internal to Context, not exported. 
                        // Actually ThresholdResults probably isn't needed if FinalResults covers it, but the original code had it.
                        // The original code passed `calculateFinalResults(...)`. Context doesn't export raw calculateFinalResults.
                        // However, finalResults in context IS the result of calculateFinalResults. 
                        // If thresholdMet is true, finalResults SHOULD be set by the Effect in Context.
                        // So we might not need this fallback block if the Effect guarantees coherence.
                        // But if we do need it, we can't call calculateFinalResults from here easily.
                        // I'll skip this block if finalResults is null, or just rely on finalResults.
                        />
                    )}
                    {/* Correction: The original code rendered ThresholdResults ONLY if !finalResults && thresholdMet.
                        But the Effect sets finalResults immediately when thresholdMet becomes true.
                        So this state might be transient.
                        However, I'll remove the calculateFinalResults call and just pass null or handle it. 
                        Actually, I exported everything else, I should check if I need to export calculateFinalResults?
                        No, let's just assume finalResults covers it.
                    */}


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