import React, { useState, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import '../styles/index.css';

export function Simulation() {
  // State for file upload and results
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('comparison'); // 'comparison', 'calculation', 'methodology'
  
  // Model comparison state
  const [comparisonResults, setComparisonResults] = useState(null);
  
  // Test images state
  const [testImages, setTestImages] = useState([]);
  const [showTestImages, setShowTestImages] = useState(false);
  
  // Manual calculation state
  const [manualInputs, setManualInputs] = useState({
    cellType: 'WBC',
    fieldCounts: ['', '', '', '', '', '', '', '', '', ''], // 10 HPFs
    averagePerField: '',
    numFields: 10,
    multiplierOverride: ''
  });
  const [calculationResults, setCalculationResults] = useState(null);
  
  // Methodology state
  const [methodologyData, setMethodologyData] = useState(null);
  
  const fileInputRef = useRef(null);
  const API_URL = 'http://localhost:5000';

  // Load test images on mount
  useEffect(() => {
    fetchTestImages();
  }, []);

  const fetchTestImages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/simulation/test-images`);
      const data = await response.json();
      if (data.success) {
        setTestImages(data.images);
      }
    } catch (error) {
      console.error('Error loading test images:', error);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setComparisonResults(null);
    }
  };

  // Select test image
  const selectTestImage = async (image) => {
    try {
      const response = await fetch(`${API_URL}${image.path}`);
      const blob = await response.blob();
      const file = new File([blob], image.filename, { type: 'image/jpeg' });
      setSelectedImage(file);
      setImagePreview(`${API_URL}${image.path}`);
      setComparisonResults(null);
      setShowTestImages(false);
    } catch (error) {
      console.error('Error loading test image:', error);
    }
  };

  // Run model comparison
  const runModelComparison = async () => {
    if (!selectedImage) {
      alert('Please select an image first');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch(`${API_URL}/api/simulation/compare-models`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setComparisonResults(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate estimated count
  const calculateManualCount = async () => {
    const { cellType, fieldCounts, averagePerField, numFields, multiplierOverride, useHighMultiplier } = manualInputs;
    
    // Parse field counts if provided
    const validFieldCounts = fieldCounts
      .filter(c => c !== '' && !isNaN(parseInt(c)))
      .map(c => parseInt(c));
    
    let avgPerField = parseFloat(averagePerField);
    
    // Calculate average from field counts if available
    if (validFieldCounts.length > 0) {
      avgPerField = validFieldCounts.reduce((a, b) => a + b, 0) / validFieldCounts.length;
    }

    if (isNaN(avgPerField) || avgPerField < 0) {
      alert('Please enter valid field count(s) or average per field');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/simulation/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cell_type: cellType,
          average_per_field: avgPerField,
          num_fields: validFieldCounts.length > 0 ? validFieldCounts.length : parseInt(numFields),
          field_counts: validFieldCounts.length > 0 ? validFieldCounts : undefined,
          multiplier_override: multiplierOverride ? parseInt(multiplierOverride) : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setCalculationResults(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to calculate');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch methodology data
  const fetchMethodology = async () => {
    try {
      const response = await fetch(`${API_URL}/api/simulation/classification-basis`);
      const data = await response.json();
      if (data.success) {
        setMethodologyData(data.classification_methodology);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Load methodology on tab switch
  React.useEffect(() => {
    if (activeTab === 'methodology' && !methodologyData) {
      fetchMethodology();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Simulation & Comparison
          </h1>
          <p className="text-gray-600">
            Compare detection models, understand methodology, and perform manual calculations
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-1 flex gap-1">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'comparison'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Model Comparison
            </button>
            <button
              onClick={() => setActiveTab('calculation')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'calculation'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Manual vs Automated
            </button>
            <button
              onClick={() => setActiveTab('methodology')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'methodology'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Classification Basis
            </button>
          </div>
        </div>

        {/* Model Comparison Tab */}
        {activeTab === 'comparison' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Select Blood Smear Image</h2>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors mb-4"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                    ) : (
                      <div>
                        <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <p className="text-gray-600">Click to upload your own image</p>
                      </div>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setShowTestImages(!showTestImages)}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
                  >
                    {showTestImages ? 'Hide Test Images' : `Use Test Dataset (${testImages.length} images)`}
                  </button>
                  
                  {showTestImages && (
                    <div className="mt-4 max-h-96 overflow-y-auto border rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {testImages.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectTestImage(img)}
                            className="text-left p-2 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          >
                            <div className="text-xs font-semibold text-gray-700 mb-1">
                              {img.disease_type}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {img.filename.split('_').slice(0, 3).join('_')}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <button
                    onClick={runModelComparison}
                    disabled={!selectedImage || isLoading}
                    className={`w-full py-4 rounded-lg font-semibold text-white transition-all ${
                      !selectedImage || isLoading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? 'Analyzing...' : 'Run Comparison'}
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    Compares YOLOv8-NAS vs Standard YOLOv8 with same ConvNeXt classification
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison Results */}
            {comparisonResults && (
              <div className="space-y-6">
                {/* Model Comparison Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Enhanced Model */}
                  <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                    <div className="mb-4">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm font-medium">
                        Enhanced
                      </span>
                      <h3 className="text-lg font-semibold mt-2">{comparisonResults.enhanced_model.name}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{comparisonResults.enhanced_model.description}</p>
                    
                    {/* Architecture Details */}
                    <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-2 text-sm">Architecture Details</h4>
                      <div className="space-y-1 text-xs text-gray-700">
                        <div><span className="font-semibold">Detection:</span> {comparisonResults.enhanced_model.architecture.detection}</div>
                        <div><span className="font-semibold">Scales:</span> {comparisonResults.enhanced_model.architecture.scales}</div>
                        <div><span className="font-semibold">Kernels:</span> {comparisonResults.enhanced_model.architecture.kernels}</div>
                        <div><span className="font-semibold">Attention:</span> {comparisonResults.enhanced_model.architecture.attention}</div>
                        <div><span className="font-semibold">Classification:</span> {comparisonResults.enhanced_model.architecture.classification}</div>
                      </div>
                    </div>

                    {/* Detection Results */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold text-gray-800">{comparisonResults.enhanced_model.detection_results.counts.WBC}</div>
                        <div className="text-xs text-gray-600">WBC</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold text-gray-800">{comparisonResults.enhanced_model.detection_results.counts.RBC}</div>
                        <div className="text-xs text-gray-600">RBC</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold text-gray-800">{comparisonResults.enhanced_model.detection_results.counts.Platelets}</div>
                        <div className="text-xs text-gray-600">Platelets</div>
                      </div>
                    </div>

                    {/* WBC Classification */}
                    <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                      <h4 className="font-medium text-gray-800 mb-2 text-sm">WBC Classification (ConvNeXt)</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cell Types:</span>
                          <span className="font-bold">{comparisonResults.enhanced_model.wbc_classification.cell_types_detected}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Disease Cells:</span>
                          <span className="font-bold text-gray-800">{comparisonResults.enhanced_model.wbc_classification.disease_cells}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Confidence:</span>
                          <span className="font-bold">{comparisonResults.enhanced_model.wbc_classification.avg_confidence}%</span>
                        </div>
                      </div>

                      {/* WBC Differential Breakdown */}
                      {comparisonResults.enhanced_model.wbc_classification.differential && 
                       Object.keys(comparisonResults.enhanced_model.wbc_classification.differential).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">WBC Differential:</div>
                          {Object.entries(comparisonResults.enhanced_model.wbc_classification.differential).map(([type, data]) => (
                            <div key={type} className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{type}:</span>
                              <span className={`font-medium ${
                                data.status === 'high' ? 'text-red-600' : 
                                data.status === 'low' ? 'text-amber-600' : 
                                'text-green-600'
                              }`}>
                                {data.percentage?.toFixed(1)}% ({data.count})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RBC/Sickle Cell Analysis - Only show if sickle cells detected or has valid analysis */}
                    {comparisonResults.enhanced_model.rbc_analysis?.sickle_cell_analysis && (
                      <div className={`mb-4 p-3 rounded border ${
                        comparisonResults.enhanced_model.rbc_analysis.sickle_cells_detected > 0 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <h4 className={`font-medium mb-2 text-sm ${
                          comparisonResults.enhanced_model.rbc_analysis.sickle_cells_detected > 0 
                            ? 'text-red-800' 
                            : 'text-green-800'
                        }`}>RBC Analysis (Sickle Cell Detection)</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total RBCs Analyzed:</span>
                            <span className="font-bold">
                              {comparisonResults.enhanced_model.rbc_analysis.sickle_cell_analysis.total_rbc_analyzed}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sickle Cells Detected:</span>
                            <span className={`font-bold ${
                              comparisonResults.enhanced_model.rbc_analysis.sickle_cells_detected > 0 
                                ? 'text-red-700' 
                                : 'text-green-700'
                            }`}>
                              {comparisonResults.enhanced_model.rbc_analysis.sickle_cell_analysis.sickle_cell_count}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sickle Cell %:</span>
                            <span className="font-bold">
                              {comparisonResults.enhanced_model.rbc_analysis.sickle_cell_analysis.percentage}%
                            </span>
                          </div>
                          <div className={`mt-2 pt-2 border-t ${
                            comparisonResults.enhanced_model.rbc_analysis.sickle_cells_detected > 0 
                              ? 'border-red-200' 
                              : 'border-green-200'
                          }`}>
                            <p className={`font-medium ${
                              comparisonResults.enhanced_model.rbc_analysis.sickle_cells_detected > 0 
                                ? 'text-red-800' 
                                : 'text-green-800'
                            }`}>
                              {comparisonResults.enhanced_model.rbc_analysis.sickle_cell_analysis.interpretation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Baseline Model */
                  <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-400">
                    <div className="mb-4">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm font-medium">
                        Baseline
                      </span>
                      <h3 className="text-lg font-semibold mt-2">{comparisonResults.baseline_model.name}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{comparisonResults.baseline_model.description}</p>
                    
                    {/* Architecture Details */}
                    <div className="mb-4 p-3 bg-gray-100 rounded border border-gray-300">
                      <h4 className="font-medium text-gray-700 mb-2 text-sm">Architecture Details</h4>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div><span className="font-semibold">Detection:</span> {comparisonResults.baseline_model.architecture.detection}</div>
                        <div><span className="font-semibold">Scales:</span> {comparisonResults.baseline_model.architecture.scales}</div>
                        <div><span className="font-semibold">Kernels:</span> {comparisonResults.baseline_model.architecture.kernels}</div>
                        <div><span className="font-semibold">Attention:</span> {comparisonResults.baseline_model.architecture.attention}</div>
                        <div><span className="font-semibold">Classification:</span> {comparisonResults.baseline_model.architecture.classification}</div>
                      </div>
                    </div>

                    {/* Detection Results */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold text-gray-800">{comparisonResults.baseline_model.detection_results.counts.WBC}</div>
                        <div className="text-xs text-gray-600">WBC</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold text-gray-800">{comparisonResults.baseline_model.detection_results.counts.RBC}</div>
                        <div className="text-xs text-gray-600">RBC</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold text-gray-800">{comparisonResults.baseline_model.detection_results.counts.Platelets}</div>
                        <div className="text-xs text-gray-600">Platelets</div>
                      </div>
                    </div>

                    {/* WBC Classification */}
                    <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                      <h4 className="font-medium text-gray-800 mb-2 text-sm">WBC Classification (ConvNeXt)</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cell Types:</span>
                          <span className="font-bold">{comparisonResults.baseline_model.wbc_classification.cell_types_detected}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Disease Cells:</span>
                          <span className="font-bold text-gray-800">{comparisonResults.baseline_model.wbc_classification.disease_cells}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Confidence:</span>
                          <span className="font-bold">{comparisonResults.baseline_model.wbc_classification.avg_confidence}%</span>
                        </div>
                      </div>

                      {/* WBC Differential Breakdown */}
                      {comparisonResults.baseline_model.wbc_classification.differential && 
                       Object.keys(comparisonResults.baseline_model.wbc_classification.differential).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">WBC Differential:</div>
                          {Object.entries(comparisonResults.baseline_model.wbc_classification.differential).map(([type, data]) => (
                            <div key={type} className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{type}:</span>
                              <span className={`font-medium ${
                                data.status === 'high' ? 'text-red-600' : 
                                data.status === 'low' ? 'text-amber-600' : 
                                'text-green-600'
                              }`}>
                                {data.percentage?.toFixed(1)}% ({data.count})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RBC/Sickle Cell Analysis - Baseline */}
                    {comparisonResults.baseline_model.rbc_analysis?.sickle_cell_analysis && (
                      <div className="mb-4 p-3 bg-gray-100 rounded border border-gray-300">
                        <h4 className="font-medium text-gray-700 mb-2 text-sm">RBC Analysis (Sickle Cell Detection)</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total RBCs Analyzed:</span>
                            <span className="font-bold">
                              {comparisonResults.baseline_model.rbc_analysis.sickle_cell_analysis.total_rbc_analyzed}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sickle Cells Detected:</span>
                            <span className="font-bold text-gray-700">
                              {comparisonResults.baseline_model.rbc_analysis.sickle_cell_analysis.sickle_cell_count}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sickle Cell %:</span>
                            <span className="font-bold">
                              {comparisonResults.baseline_model.rbc_analysis.sickle_cell_analysis.percentage}%
                            </span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-300">
                            <p className="text-gray-700 font-medium">
                              {comparisonResults.baseline_model.rbc_analysis.sickle_cell_analysis.interpretation}
                            </p>
                            {comparisonResults.baseline_model.rbc_analysis.note && (
                              <p className="text-gray-500 text-xs mt-1 italic">
                                Note: {comparisonResults.baseline_model.rbc_analysis.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                }</div>
                {/* Performance Summary */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4">Performance Comparison</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded">
                      <div className="text-2xl font-bold text-gray-800">
                        +{comparisonResults.comparison.detection.improvement_percent}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Detection Rate</div>
                      <div className="text-xs text-gray-500 mt-1">
                        +{comparisonResults.comparison.detection.cells_detected_difference} cells
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded">
                      <div className="text-2xl font-bold text-gray-800">
                        +{comparisonResults.comparison.classification.disease_difference}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Disease Cells Found</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Enhanced: {comparisonResults.comparison.classification.enhanced_disease_cells} | 
                        Baseline: {comparisonResults.comparison.classification.baseline_disease_cells}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded">
                      <div className="text-2xl font-bold text-gray-800">
                        +{comparisonResults.comparison.speed.improvement_percent}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Speed</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {comparisonResults.comparison.speed.enhanced_ms} ms vs {comparisonResults.comparison.speed.baseline_ms} ms
                      </div>
                    </div>
                  </div>
                  <p className="text-center mt-4 text-sm text-gray-600">
                    {comparisonResults.comparison.summary}
                  </p>
                </div>

                {/* Key Improvements Table */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4">Key Architectural Improvements</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-700">Feature</th>
                          <th className="text-left py-2 px-2 text-gray-700">Enhanced</th>
                          <th className="text-left py-2 px-2 text-gray-700">Baseline</th>
                          <th className="text-left py-2 px-2 text-gray-700">Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResults.key_improvements.map((improvement, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-2 px-2 font-semibold text-gray-800">{improvement.feature}</td>
                            <td className="py-2 px-2 text-gray-700">{improvement.enhanced}</td>
                            <td className="py-2 px-2 text-gray-600">{improvement.baseline}</td>
                            <td className="py-2 px-2 text-gray-700">{improvement.impact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Calculation Tab */}
        {activeTab === 'calculation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estimated Count Calculator */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">Estimated</span>
                Blood Smear Count Calculation
              </h2>
              
              {/* Formula Display */}
              <div className="mb-6 space-y-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-medium text-green-800 mb-2">WBC Estimation Formula:</h3>
                  <div className="text-center py-2 bg-white rounded border">
                    <span className="font-mono text-lg font-semibold text-green-700">
                      WBC/μL = Ave. WBC/HPF × 2,000
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    *Minimum of 10 HPFs is recommended. Multiplier may vary (1,500-2,500) based on microscope specs.
                  </p>
                </div>
                
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h3 className="font-medium text-red-800 mb-2">RBC Estimation Formula:</h3>
                  <div className="text-center py-2 bg-white rounded border">
                    <span className="font-mono text-lg font-semibold text-red-700">
                      Estimated RBC (cells/μL) = Avg RBC count/10HPF × 200,000
                    </span>
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    *Count RBCs in 10 HPFs under oil immersion (100x), calculate average, then multiply. Typically 200-300 RBCs per HPF.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cell Type</label>
                  <select
                    value={manualInputs.cellType}
                    onChange={(e) => setManualInputs({...manualInputs, cellType: e.target.value})}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    <option value="WBC">WBC (White Blood Cells)</option>
                    <option value="RBC">RBC (Red Blood Cells)</option>
                  </select>
                </div>

                {/* Field counts input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Count per Field (enter counts for each HPF/field):
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {manualInputs.fieldCounts.map((count, idx) => (
                      <input
                        key={idx}
                        type="number"
                        value={count}
                        onChange={(e) => {
                          const newCounts = [...manualInputs.fieldCounts];
                          newCounts[idx] = e.target.value;
                          setManualInputs({...manualInputs, fieldCounts: newCounts});
                        }}
                        placeholder={`F${idx + 1}`}
                        className="w-full border rounded-lg px-2 py-2 text-center text-sm"
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter cell counts from 10 different fields (HPF for WBC, 100x for RBC)</p>
                </div>

                <div className="text-center text-gray-500 font-medium">— OR —</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Direct Average per Field
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualInputs.averagePerField}
                    onChange={(e) => setManualInputs({...manualInputs, averagePerField: e.target.value})}
                    placeholder="e.g., 3.5 for WBC or 250 for RBC"
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                {manualInputs.cellType === 'WBC' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Multiplier (optional, default: 2,000)
                    </label>
                    <input
                      type="number"
                      value={manualInputs.multiplierOverride}
                      onChange={(e) => setManualInputs({...manualInputs, multiplierOverride: e.target.value})}
                      placeholder="Default: 2000"
                      className="w-full border rounded-lg px-4 py-2"
                    />
                  </div>
                )}

                {manualInputs.cellType === 'RBC' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Multiplier (optional, default: 200,000)
                    </label>
                    <input
                      type="number"
                      value={manualInputs.multiplierOverride}
                      onChange={(e) => setManualInputs({...manualInputs, multiplierOverride: e.target.value})}
                      placeholder="Default: 200000"
                      className="w-full border rounded-lg px-4 py-2"
                    />
                  </div>
                )}

                <button
                  onClick={calculateManualCount}
                  disabled={isLoading}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Calculate Estimated Count
                </button>
              </div>

              {/* Reference Info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Typical Values:</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-blue-600">
                      <th className="pb-2">Parameter</th>
                      <th className="pb-2">WBC</th>
                      <th className="pb-2">RBC</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr>
                      <td className="py-1">Typical per field</td>
                      <td>0-5 cells/HPF</td>
                      <td>200-300 cells/100x</td>
                    </tr>
                    <tr>
                      <td className="py-1">Multiplier</td>
                      <td>× 2,000</td>
                      <td>× 200,000</td>
                    </tr>
                    <tr>
                      <td className="py-1">Fields to count</td>
                      <td>≥10 HPF</td>
                      <td>Multiple 100x fields</td>
                    </tr>
                    <tr>
                      <td className="py-1">Normal result</td>
                      <td>4,000-11,000/μL</td>
                      <td>4.0-5.5 × 10⁶/μL</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Results / Automated Comparison */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Results</span>
                Estimated Count Results
              </h2>

              {calculationResults ? (
                <div className="space-y-6">
                  {/* Estimated Result */}
                  {calculationResults.estimated_calculation && (
                    <div className={`p-4 rounded-lg border ${
                      calculationResults.cell_type === 'WBC' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        calculationResults.cell_type === 'WBC' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {calculationResults.cell_type} Estimated Count
                      </h3>
                      
                      <div className="text-center mb-4">
                        <div className={`text-4xl font-bold ${
                          calculationResults.cell_type === 'WBC' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {calculationResults.estimated_calculation.cells_per_ul?.toLocaleString()}
                        </div>
                        <div className="text-gray-600">
                          cells per μL
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-lg mb-4">
                        <div className="text-sm font-mono text-center text-gray-700">
                          {calculationResults.estimated_calculation.formula}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-600">Average per Field:</div>
                        <div className="font-medium">
                          {calculationResults.estimated_calculation.average_per_hpf || calculationResults.estimated_calculation.average_per_field}
                        </div>
                        
                        <div className="text-gray-600">Fields Counted:</div>
                        <div className="font-medium">
                          {calculationResults.estimated_calculation.num_hpf_counted || calculationResults.estimated_calculation.num_fields_counted}
                        </div>
                        
                        <div className="text-gray-600">Multiplier:</div>
                        <div className="font-medium">
                          × {calculationResults.estimated_calculation.multiplier?.toLocaleString()}
                        </div>
                        
                        {calculationResults.cell_type === 'RBC' && (
                          <>
                            <div className="text-gray-600">Cells per μL:</div>
                            <div className="font-medium">{calculationResults.estimated_calculation.cells_per_ul_millions}</div>
                          </>
                        )}
                        
                        <div className="text-gray-600">SI Units:</div>
                        <div className="font-medium">
                          {calculationResults.estimated_calculation.cells_per_liter_scientific} cells/L
                        </div>
                      </div>

                      {calculationResults.estimated_calculation.note && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                          <strong>Note:</strong> {calculationResults.estimated_calculation.note}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reference Ranges */}
                  {calculationResults.reference_ranges && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Reference Ranges</h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b border-gray-300">
                              <th className="pb-2 font-medium text-gray-700">Cell Type</th>
                              <th className="pb-2 font-medium text-gray-700">Normal Range (cells/μL)</th>
                              <th className="pb-2 font-medium text-gray-700">SI Units (cells/L)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-gray-200">
                              <td className="py-2 text-gray-700">WBC</td>
                              <td className="py-2 font-semibold text-blue-600">4,000 - 11,000</td>
                              <td className="py-2 font-medium text-blue-600">4.0 - 11.0 × 10⁹/L</td>
                            </tr>
                            <tr className="border-t border-gray-200">
                              <td className="py-2 text-gray-700">RBC (Male)</td>
                              <td className="py-2 font-semibold text-red-600">4.5 - 6.0 × 10⁶</td>
                              <td className="py-2 font-medium text-red-600">4.5 - 6.0 × 10¹²/L</td>
                            </tr>
                            <tr className="border-t border-gray-200">
                              <td className="py-2 text-gray-700">RBC (Female)</td>
                              <td className="py-2 font-semibold text-red-600">4.0 - 5.5 × 10⁶</td>
                              <td className="py-2 font-medium text-red-600">4.0 - 5.5 × 10¹²/L</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Interpretation */}
                      {calculationResults.estimated_calculation && (
                        <div className="mt-4 p-3 bg-white rounded-lg border">
                          <div className="text-sm font-medium text-gray-700 mb-1">Interpretation:</div>
                          {(() => {
                            const result = calculationResults.estimated_calculation;
                            const ranges = calculationResults.reference_ranges[calculationResults.cell_type];
                            const cellsPerUl = result.cells_per_ul;
                            
                            if (calculationResults.cell_type === 'WBC') {
                              if (cellsPerUl < ranges.low) {
                                return <div className="text-yellow-600">{ranges.interpretation.low}</div>;
                              } else if (cellsPerUl > ranges.high) {
                                return <div className="text-red-600">{ranges.interpretation.high}</div>;
                              } else {
                                return <div className="text-green-600">{ranges.interpretation.normal}</div>;
                              }
                            } else {
                              // RBC - compare in cells/μL (millions)
                              if (cellsPerUl < ranges.female_min) {
                                return <div className="text-yellow-600">{ranges.interpretation.low}</div>;
                              } else if (cellsPerUl > ranges.male_max) {
                                return <div className="text-red-600">{ranges.interpretation.high}</div>;
                              } else {
                                return <div className="text-green-600">{ranges.interpretation.normal}</div>;
                              }
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p>Enter values and calculate to see results</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Methodology Tab */}
        {activeTab === 'methodology' && (
          <div className="space-y-6">
            {methodologyData ? (
              <>
                {/* Detection Stage */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">Stage 1</span>
                    Cell Detection - {methodologyData.detection_stage.model}
                  </h2>
                  <p className="text-gray-600 mb-4">{methodologyData.detection_stage.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium text-gray-800 mb-2">Capabilities:</h3>
                      <ul className="space-y-2">
                        {methodologyData.detection_stage.capabilities.map((cap, i) => (
                          <li key={i} className="flex items-center gap-2 text-gray-700">
                            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {cap}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-2">Architecture:</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Backbone:</span>
                          <span className="font-medium">{methodologyData.detection_stage.architecture.backbone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Neck:</span>
                          <span className="font-medium">{methodologyData.detection_stage.architecture.neck}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Input Size:</span>
                          <span className="font-medium">{methodologyData.detection_stage.architecture.input_size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Training Images:</span>
                          <span className="font-medium">{methodologyData.detection_stage.architecture.training_images}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Classification Stage */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Stage 2</span>
                    Cell Classification - {methodologyData.classification_stage.model}
                  </h2>
                  <p className="text-gray-600 mb-4">{methodologyData.classification_stage.description}</p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Normal WBC */}
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-800 mb-2">Normal WBC Types</h3>
                      <ul className="text-sm space-y-1 text-gray-700">
                        {methodologyData.classification_stage.class_categories.normal_wbc.map((cls, i) => (
                          <li key={i}>• {cls}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Leukemia WBC */}
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h3 className="font-medium text-red-800 mb-2">Leukemia Classifications</h3>
                      <ul className="text-sm space-y-1 text-gray-700">
                        {methodologyData.classification_stage.class_categories.leukemia_wbc.map((cls, i) => (
                          <li key={i}>• {cls}</li>
                        ))}
                      </ul>
                    </div>

                    {/* RBC */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-medium text-purple-800 mb-2">RBC</h3>
                      <ul className="text-sm space-y-1 text-gray-700">
                        {methodologyData.classification_stage.class_categories.rbc.map((cls, i) => (
                          <li key={i}>• {cls}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Preprocessing Pipeline */}
                  <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <h3 className="font-medium text-yellow-800 mb-2">Preprocessing Pipeline:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      {methodologyData.classification_stage.preprocessing.steps.map((step, i) => (
                        <div key={i} className="bg-white p-2 rounded border text-sm text-gray-700">
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Disease Interpretation */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">Stage 3</span>
                    Disease Interpretation Criteria
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Sickle Cell */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-800 mb-2">Sickle Cell Anemia</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Basis: {methodologyData.disease_interpretation.sickle_cell_anemia.basis}
                      </p>
                      <ul className="text-sm space-y-1">
                        {methodologyData.disease_interpretation.sickle_cell_anemia.interpretation_levels.map((level, i) => (
                          <li key={i} className="text-gray-700">• {level}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Acute Leukemia */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-800 mb-2">Acute Leukemia</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Basis: {methodologyData.disease_interpretation.acute_leukemia.basis}
                      </p>
                      <p className="text-sm text-red-600 font-medium mb-2">
                        Threshold: {methodologyData.disease_interpretation.acute_leukemia.threshold}
                      </p>
                      <ul className="text-sm space-y-1">
                        {methodologyData.disease_interpretation.acute_leukemia.types.map((type, i) => (
                          <li key={i} className="text-gray-700">• {type}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Chronic Leukemia */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-800 mb-2">Chronic Leukemia</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Basis: {methodologyData.disease_interpretation.chronic_leukemia.basis}
                      </p>
                      <ul className="text-sm space-y-1">
                        {methodologyData.disease_interpretation.chronic_leukemia.types.map((type, i) => (
                          <li key={i} className="text-gray-700">• {type}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading methodology data...</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Simulation;
