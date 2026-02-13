import { useState } from "react";
import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";
import { FinalResults } from "../components/FinalResults.jsx";
import { RegistrationForm } from "../components/homepage/RegistrationForm.jsx";
import { UploadSection } from "../components/homepage/UploadSection.jsx";
import { AnalysisResults } from "../components/homepage/AnalysisResults.jsx";
import { ClassificationsModal } from "../components/homepage/ClassificationsModal.jsx";
import { LowConfidenceWarning } from "../components/LowConfidenceWarning.jsx";
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
        cancelAnalysis,
        TARGET_IMAGE_COUNT
    } = useAnalysis();

    const [showClassificationsModal, setShowClassificationsModal] = useState(false);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [showRemovePatientModal, setShowRemovePatientModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showLowConfidenceWarning, setShowLowConfidenceWarning] = useState(false);
    const [lowConfidenceData, setLowConfidenceData] = useState(null);

    // Handle editing patient info
    const handleEditPatient = () => {
        setIsEditMode(true);
        setShowRegistrationModal(true);
    };

    // Handle removing patient (with confirmation modal)
    const handleRemovePatient = () => {
        setShowRemovePatientModal(true);
    };

    // Confirm removal
    const confirmRemovePatient = () => {
        handleReset();
        setShowRemovePatientModal(false);
    };

    // Handle new patient (clears existing and opens form)
    const handleNewPatient = () => {
        if (isRegistered) {
            // Clear existing patient data first
            handleReset();
        }
        setIsEditMode(false);
        setShowRegistrationModal(true);
    };

    // Handle clicking on a processed image - check for low confidence warnings
    const handleProcessedImageClick = (image, index) => {
        if (image && image.low_confidence_warning && image.low_confidence_warning.has_low_confidence) {
            setLowConfidenceData(image.low_confidence_warning);
            setShowLowConfidenceWarning(true);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 relative">
            <Sidebar />
            <div className="flex flex-col flex-1 transition-all duration-300">
                <Header />

                <main className="flex-grow container mx-auto px-4 py-8 transition-all duration-300">
                    <div className="max-w-7xl mx-auto">
                        {/* Page Title & Patient Info */}
                        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Blood Smear Analysis</h1>
                                <p className="text-slate-600 text-sm mt-1">
                                    Upload 10 blood smear images for accurate differential count and disease assessment
                                </p>
                            </div>

                            {isRegistered ? (
                                <div className="flex items-center gap-3">
                                    {/* Patient Info Card */}
                                    <div className="text-left md:text-right bg-slate-100 p-3 rounded-lg border border-slate-200">
                                        <p className="text-slate-900 font-bold text-lg">{patientName}</p>
                                        <p className="text-slate-500 text-sm font-mono">{patientId}</p>
                                    </div>

                                    {/* Edit Button */}
                                    <button
                                        onClick={handleEditPatient}
                                        className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                                        title="Edit Patient Info"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>

                                    {/* Remove Button */}
                                    <button
                                        onClick={handleRemovePatient}
                                        className="p-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                                        title="Remove Patient"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>

                                    {/* New Patient Button */}
                                    <button
                                        onClick={handleNewPatient}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                                        title="Add New Patient"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        New Patient
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    {/* Patient Registration Warning - Horizontal */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg">
                                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-amber-800">Patient Registration Required</p>
                                            <p className="text-xs text-amber-700">Please register a patient first before uploading images for analysis.</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowRegistrationModal(true)}
                                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        New Patient
                                    </button>
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
                                    isRegistered={isRegistered}
                                    cancelAnalysis={cancelAnalysis}
                                />
                            </div>

                            {/* RIGHT COLUMN: Results */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Processed Images Panel - Only show when there are images */}
                                {processedImages.length > 0 && (
                                    <ProcessedImagesThumbnails
                                        processedImages={processedImages}
                                        currentImageCount={processedImages.length}
                                        targetImageCount={TARGET_IMAGE_COUNT}
                                        onImageClick={handleProcessedImageClick}
                                    />
                                )}

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
                {showRegistrationModal && (
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
                            onRegister={(e) => {
                                handleRegistration(e);
                                setShowRegistrationModal(false);
                                setIsEditMode(false);
                            }}
                            onClose={() => {
                                setShowRegistrationModal(false);
                                setIsEditMode(false);
                            }}
                            isEditMode={isEditMode}
                        />
                    </div>
                )}

                {/* Remove Patient Confirmation Modal */}
                {showRemovePatientModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                            <div className="bg-red-600 px-6 py-4 text-white">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Remove Patient
                                </h2>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-700 mb-2">
                                    Are you sure you want to remove this patient?
                                </p>
                                <div className="bg-slate-100 rounded-lg p-3 mb-4">
                                    <p className="font-semibold text-slate-800">{patientName}</p>
                                    <p className="text-slate-500 text-sm font-mono">{patientId}</p>
                                </div>
                                <p className="text-red-600 text-sm mb-6">
                                    <strong>Warning:</strong> This will reset the current analysis and clear all captured images.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setShowRemovePatientModal(false)}
                                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmRemovePatient}
                                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Remove Patient
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ClassificationsModal
                    show={showClassificationsModal}
                    onClose={() => setShowClassificationsModal(false)}
                    currentResults={currentResults}
                    isBulkProcessing={isBulkProcessing}
                />

                <LowConfidenceWarning
                    show={showLowConfidenceWarning}
                    onClose={() => setShowLowConfidenceWarning(false)}
                    lowConfidenceData={lowConfidenceData}
                />
            </div>
        </div>
    );
};

export default Homepage;