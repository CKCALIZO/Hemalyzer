"""
Enhanced AdaptiveCellPreprocessing with Baseline Normalization
Uses BAS_47.jpg as the reference baseline for consistent preprocessing
"""

import cv2
import numpy as np
from PIL import Image
import os

# ============================================================
# ADAPTIVE CELL PREPROCESSING (Matches Training Pipeline EXACTLY)
# From train_convnext_leukemia_classifier.py
# ============================================================
class BaselineAdaptiveCellPreprocessing:
    """
    Adaptive preprocessing that works across quality variations.
    MATCHES TRAINING SCRIPT EXACTLY (no extra baseline normalization).
    
    Pipeline:
    1. Resize to target size (if needed)
    2. Stain normalization (OD space normalization)
    3. CLAHE in YUV space (clipLimit=3.0, tileGridSize=8x8)
    4. Cell detection and centering (Otsu thresholding + contour detection)
    """
    
    def __init__(self, target_size=384, baseline_image_path=None):
        """
        Args:
            target_size: Output image size (384 for ConvNeXt)
            baseline_image_path: Ignored (kept for compatibility)
        """
        self.target_size = target_size
    
    def __call__(self, img):
        """Apply preprocessing to PIL Image"""
        img_array = np.array(img)
        
        # 1. Resize to target size first for consistency 
        # (Training does this via transforms, we do it here to ensure consistent input size)
        img_resized = cv2.resize(img_array, (self.target_size, self.target_size))
        
        # 2. Stain normalization 
        img_stain_norm = self._normalize_staining(img_resized)
        
        # 3. Adaptive histogram equalization
        img_enhanced = self._adaptive_histogram_equalization(img_stain_norm)
        
        # 4. Cell detection and centering
        img_centered = self._detect_and_center_cell(img_enhanced)
        
        return Image.fromarray(img_centered)
    
    def _normalize_staining(self, img_array):
        """
        Normalize H&E staining using simplified OD space approach.
        Matches training script exactly.
        """
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
        """
        Apply CLAHE separately to luminance channel in YUV space.
        Matches training script: clipLimit=3.0, tileGridSize=(8, 8)
        """
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        
        # Apply to luminance channel in YUV space
        img_yuv = cv2.cvtColor(img_array, cv2.COLOR_RGB2YUV)
        img_yuv[:, :, 0] = clahe.apply(img_yuv[:, :, 0])
        img_enhanced = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2RGB)
        
        return img_enhanced
    
    def _detect_and_center_cell(self, img_array):
        """
        Detect cell and center it in frame using Otsu thresholding.
        Matches training script exactly.
        """
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


# Test the enhanced preprocessing
if __name__ == "__main__":
    print("Testing Enhanced Baseline Preprocessing...")
    
    # Create enhanced preprocessor
    enhanced_preprocessor = BaselineAdaptiveCellPreprocessing(
        target_size=384,
        baseline_image_path=os.path.join(os.path.dirname(__file__), "..", "ConvNext Single-Cell Classification", "PBC_dataset_normal_DIB", "basophil", "BAS_47.jpg")
    )
    
    # Test images
    test_images = [
        os.path.join(os.path.dirname(__file__), "..", "ConvNext Single-Cell Classification", "PBC_dataset_normal_DIB", "basophil", "BAS_47.jpg"),
        os.path.join(os.path.dirname(__file__), "..", "ConvNext Single-Cell Classification", "Chronic myeloid leukemia", "basophil", "BAS_0001.png")
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
        
        print("✅ Preprocessing completed successfully")