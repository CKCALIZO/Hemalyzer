"""
Enhanced AdaptiveCellPreprocessing with Baseline Normalization
Uses BAS_47.jpg as the reference baseline for consistent preprocessing
"""

import cv2
import numpy as np
from PIL import Image
import os

class BaselineAdaptiveCellPreprocessing:
    """
    Enhanced preprocessing that normalizes all images to match BAS_47.jpg baseline
    This ensures consistent color and contrast characteristics across all images
    """
    
    def __init__(self, target_size=384, baseline_image_path="Normal/BAS_47.jpg"):
        self.target_size = target_size
        self.baseline_image_path = baseline_image_path
        
        # Load and analyze baseline image
        self._load_baseline_reference()
        
        print(f"BaselineAdaptiveCellPreprocessing initialized:")
        print(f"  Target size: {target_size}x{target_size}")
        print(f"  Baseline reference: {baseline_image_path}")
        print(f"  Baseline mean RGB: {self.baseline_mean}")
        print(f"  Baseline std RGB: {self.baseline_std}")
    
    def _load_baseline_reference(self):
        """Load baseline image and extract reference parameters"""
        try:
            baseline_img = Image.open(self.baseline_image_path).convert('RGB')
            baseline_array = np.array(baseline_img)
            
            # Store original baseline characteristics
            self.baseline_mean = np.mean(baseline_array, axis=(0,1))
            self.baseline_std = np.std(baseline_array, axis=(0,1))
            
            # Process baseline through standard pipeline to get target characteristics
            baseline_processed = self._standard_preprocessing(baseline_array)
            self.target_mean = np.mean(baseline_processed, axis=(0,1))
            self.target_std = np.std(baseline_processed, axis=(0,1))
            
            print(f"Baseline reference loaded successfully")
            
        except Exception as e:
            print(f"Warning: Could not load baseline image {self.baseline_image_path}: {e}")
            # Use default values if baseline can't be loaded
            self.baseline_mean = np.array([220.0, 190.0, 180.0])
            self.baseline_std = np.array([45.0, 50.0, 25.0])
            self.target_mean = np.array([195.0, 191.0, 144.0])
            self.target_std = np.array([35.0, 40.0, 30.0])
    
    def __call__(self, img):
        """Apply baseline-normalized preprocessing to PIL Image"""
        img_array = np.array(img)
        
        # 1. Resize to target size first
        img_resized = cv2.resize(img_array, (self.target_size, self.target_size))
        
        # 2. Baseline color normalization
        img_normalized = self._baseline_color_normalization(img_resized)
        
        # 3. Standard stain normalization 
        img_stain_norm = self._normalize_staining(img_normalized)
        
        # 4. Adaptive histogram equalization
        img_enhanced = self._adaptive_histogram_equalization(img_stain_norm)
        
        # 5. Cell detection and centering
        img_centered = self._detect_and_center_cell(img_enhanced)
        
        # 6. Final consistency check and adjustment
        img_final = self._final_baseline_adjustment(img_centered)
        
        return Image.fromarray(img_final)
    
    def _baseline_color_normalization(self, img_array):
        """
        Normalize image colors to match baseline characteristics
        This is the key step for consistency
        """
        # Convert to float for processing
        img_float = img_array.astype(np.float32)
        
        # Calculate current image statistics
        current_mean = np.mean(img_float, axis=(0,1))
        current_std = np.std(img_float, axis=(0,1)) + 1e-6  # Avoid division by zero
        
        # Normalize to standard distribution then adjust to baseline
        img_standardized = (img_float - current_mean) / current_std
        
        # Scale to match baseline distribution
        img_baseline_matched = img_standardized * self.baseline_std + self.baseline_mean
        
        # Clip to valid range
        img_baseline_matched = np.clip(img_baseline_matched, 0, 255)
        
        return img_baseline_matched.astype(np.uint8)
    
    def _standard_preprocessing(self, img_array):
        """Standard preprocessing pipeline (for establishing baseline)"""
        # Stain normalization
        img_stain = self._normalize_staining(img_array)
        
        # CLAHE
        img_clahe = self._adaptive_histogram_equalization(img_stain)
        
        # Cell detection and centering
        img_centered = self._detect_and_center_cell(img_clahe)
        
        return img_centered
    
    def _normalize_staining(self, img_array):
        """Normalize H&E staining using OD space approach"""
        # Convert to float
        img_float = img_array.astype(np.float32) / 255.0
        img_float = np.maximum(img_float, 1e-6)
        
        # Convert to OD (optical density) space
        od = -np.log(img_float)
        
        # Normalize based on 99th percentile
        od_norm = od / (np.percentile(od, 99, axis=(0, 1), keepdims=True) + 1e-6)
        od_norm = np.clip(od_norm, 0, 1)
        
        # Convert back to RGB
        img_normalized = (255 * np.exp(-od_norm)).astype(np.uint8)
        return img_normalized
    
    def _adaptive_histogram_equalization(self, img_array):
        """Apply CLAHE in YUV space with consistent parameters"""
        # Use consistent CLAHE parameters based on baseline
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        
        # Apply to luminance channel in YUV space
        img_yuv = cv2.cvtColor(img_array, cv2.COLOR_RGB2YUV)
        img_yuv[:, :, 0] = clahe.apply(img_yuv[:, :, 0])
        img_enhanced = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2RGB)
        
        return img_enhanced
    
    def _detect_and_center_cell(self, img_array):
        """Detect cell and center it in frame"""
        # Convert to grayscale for detection
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Otsu's thresholding to find cell
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Morphological operations to clean up
        kernel = np.ones((3, 3), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Get largest contour (assumed to be the cell)
            largest_contour = max(contours, key=cv2.contourArea)
            
            # Get bounding box
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # Calculate center
            cx, cy = x + w // 2, y + h // 2
            
            # Crop around cell center with padding (0.7x + 20px)
            pad = int(max(w, h) * 0.7) + 20
            y1 = max(0, cy - pad)
            y2 = min(img_array.shape[0], cy + pad)
            x1 = max(0, cx - pad)
            x2 = min(img_array.shape[1], cx + pad)
            
            cell_crop = img_array[y1:y2, x1:x2]
            
            # Resize to target size
            cell_crop = cv2.resize(cell_crop, (self.target_size, self.target_size))
            
            return cell_crop
        
        # Fallback: just resize if no contours found
        return cv2.resize(img_array, (self.target_size, self.target_size))
    
    def _final_baseline_adjustment(self, img_array):
        """
        Final adjustment to ensure processed image matches baseline characteristics
        """
        # Convert to float for processing
        img_float = img_array.astype(np.float32)
        
        # Calculate current statistics
        current_mean = np.mean(img_float, axis=(0,1))
        current_std = np.std(img_float, axis=(0,1)) + 1e-6
        
        # Gentle adjustment towards target (baseline processed) characteristics
        adjustment_factor = 0.3  # Don't over-adjust, just nudge towards baseline
        
        # Calculate target adjustment
        mean_diff = self.target_mean - current_mean
        std_ratio = self.target_std / current_std
        
        # Apply gentle adjustment
        img_adjusted = img_float + (mean_diff * adjustment_factor)
        
        # Slight contrast adjustment
        img_adjusted = (img_adjusted - np.mean(img_adjusted, axis=(0,1))) * (1 + (std_ratio - 1) * adjustment_factor) + np.mean(img_adjusted, axis=(0,1))
        
        # Ensure valid range
        img_adjusted = np.clip(img_adjusted, 0, 255)
        
        return img_adjusted.astype(np.uint8)


# Test the enhanced preprocessing
if __name__ == "__main__":
    print("Testing Enhanced Baseline Preprocessing...")
    
    # Create enhanced preprocessor
    enhanced_preprocessor = BaselineAdaptiveCellPreprocessing(
        target_size=384,
        baseline_image_path="Normal/BAS_47.jpg"
    )
    
    # Test images
    test_images = [
        "Normal/BAS_47.jpg",
        "CML/BAS_0001.png"
    ]
    
    for img_path in test_images:
        if not os.path.exists(img_path):
            print(f"Skipping {img_path} - file not found")
            continue
            
        print(f"\n{'='*50}")
        print(f"Testing: {img_path}")
        
        # Load and process
        img = Image.open(img_path).convert('RGB')
        processed_img = enhanced_preprocessor(img)
        
        # Analyze results
        original_array = np.array(img)
        processed_array = np.array(processed_img)
        
        original_mean = np.mean(original_array, axis=(0,1))
        processed_mean = np.mean(processed_array, axis=(0,1))
        
        print(f"Original mean RGB: R={original_mean[0]:.1f}, G={original_mean[1]:.1f}, B={original_mean[2]:.1f}")
        print(f"Processed mean RGB: R={processed_mean[0]:.1f}, G={processed_mean[1]:.1f}, B={processed_mean[2]:.1f}")
        
        # Compare to baseline target
        target_mean = enhanced_preprocessor.target_mean
        diff = np.abs(processed_mean - target_mean)
        print(f"Difference from baseline target: R={diff[0]:.1f}, G={diff[1]:.1f}, B={diff[2]:.1f}")
        
        if np.max(diff) < 15:
            print("✅ Good consistency with baseline")
        else:
            print("⚠️  Still some variation from baseline")