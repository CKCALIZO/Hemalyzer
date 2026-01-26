"""
ConvNeXt Cell Classification Module
Handles WBC and RBC classification using trained ConvNeXt model

This module includes:
- AdaptiveCellPreprocessing: Preprocessing pipeline matching training exactly
- Model loading and initialization
- Cell classification with confidence thresholds

IMPORTANT: The preprocessing MUST match train_convnext_leukemia_classifier_NEW.py exactly:
1. Stain normalization (OD space normalization)
2. CLAHE in YUV space (clipLimit=3.0)
3. Cell detection and centering (Otsu + contours)
"""

import os
import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
from torchvision import transforms
from torchvision.models import convnext_base
import traceback


# ============================================================
# ADAPTIVE CELL PREPROCESSING (Matches Training Pipeline EXACTLY)
# From train_convnext_leukemia_classifier.py
# ============================================================
class AdaptiveCellPreprocessing:
    """
    Adaptive preprocessing that works across quality variations.
    MATCHES TRAINING SCRIPT EXACTLY - no extra baseline normalization.
    
    Training Pipeline (from train_convnext_leukemia_classifier.py):
    1. Stain normalization (OD space normalization)
    2. CLAHE in YUV space (clipLimit=3.0, tileGridSize=8x8)  
    3. Cell detection and centering (Otsu thresholding + contour detection)
    
    NOTE: The Resize step is handled separately by transforms.Resize() BEFORE this preprocessor,
    matching the training val_transform pipeline exactly.
    """
    
    def __init__(self, target_size=384, normalize_staining=True, detect_cell=True):
        """
        Args:
            target_size: Output image size (384 for ConvNeXt)
            normalize_staining: Whether to apply stain normalization (default: True)
            detect_cell: Whether to detect and center cell (default: True)
        """
        self.target_size = target_size
        self.normalize_staining = normalize_staining
        self.detect_cell = detect_cell
        print(f"[AdaptiveCellPreprocessing] Initialized: target_size={target_size}, "
              f"stain_norm={normalize_staining}, cell_detect={detect_cell}")
    
    def __call__(self, img):
        """Apply preprocessing to PIL Image - matches training script exactly"""
        img_array = np.array(img)
        
        # Step 1: Stain normalization (critical for varying stain intensities)
        if self.normalize_staining:
            img_array = self._normalize_staining(img_array)
        
        # Step 2: Adaptive histogram equalization (handles varying contrast)
        img_array = self._adaptive_histogram_equalization(img_array)
        
        # Step 3: Cell detection and centering (handles varying backgrounds)
        if self.detect_cell:
            img_array = self._detect_and_center_cell(img_array)
        else:
            img_array = cv2.resize(img_array, (self.target_size, self.target_size))
        
        return Image.fromarray(img_array)
    
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


# ============================================================
# GLOBAL CLASSIFIER STATE
# ============================================================
class ConvNeXtClassifier:
    """Singleton class to manage ConvNeXt model state"""
    
    def __init__(self):
        self.model = None
        self.class_names = None
        self.sickle_cell_class_idx = None
        self.device = None
        self.pre_transform = None  # Pre-preprocessor transforms
        self.transform = None  # Post-preprocessor transforms
        self.preprocessor = None
        self.sickle_cell_confidence_threshold = 0.90  # 90% confidence threshold for sickle cell detection
    
    def load_model(self, model_path='best_leukemia_model.pth'):
        """
        Load ConvNeXt classification model for WBC and RBC classification
        
        Args:
            model_path: Path to model checkpoint file
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Check if model file exists
            if not os.path.isabs(model_path):
                model_path = os.path.join(os.path.dirname(__file__), model_path)
            
            if not os.path.exists(model_path):
                print(f"Model file not found: {model_path}")
                return False
            
            # Load checkpoint
            checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
            
            # Get number of classes from checkpoint
            if isinstance(checkpoint, dict) and 'num_classes' in checkpoint:
                num_classes = checkpoint['num_classes']
                self.class_names = checkpoint.get('class_names', [])
            else:
                # Fallback classes matching training script 'Detailed' mode
                num_classes = 6
                self.class_names = [
                    'Normal',
                    'Acute Lymphoblastic Leukemia',
                    'Acute Myeloid Leukemia',
                    'Chronic Lymphocytic Leukemia',
                    'Chronic Myeloid Leukemia',
                    'Sickle Cell'
                ]
            
            # Find Sickle Cell class index (for RBC classification with confidence threshold)
            self.sickle_cell_class_idx = None
            for idx, name in enumerate(self.class_names):
                if 'sickle' in name.lower():
                    self.sickle_cell_class_idx = idx
                    break
            print(f"   Sickle Cell class index: {self.sickle_cell_class_idx}")
            print(f"   Sickle Cell confidence threshold: {self.sickle_cell_confidence_threshold * 100}%")
            
            # Initialize model using torchvision's ConvNeXt
            self.model = convnext_base(weights=None)
            
            # Modify classifier to match training script EXACTLY
            # Training script uses:
            # model.classifier = nn.Sequential(
            #     model.classifier[0],  # LayerNorm
            #     model.classifier[1],  # Flatten
            #     nn.Dropout(0.5),      # Dropout for regularization
            #     nn.Linear(in_features, num_classes)  # Final classifier
            # )
            in_features = 1024  # ConvNeXt Base has 1024 features
            self.model.classifier = nn.Sequential(
                self.model.classifier[0],  # LayerNorm2d
                self.model.classifier[1],  # Flatten
                nn.Dropout(0.5),           # Dropout (matches training)
                nn.Linear(in_features, num_classes)  # Final classifier
            )
            
            # Load trained weights
            if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'])
                print(f"ConvNeXt loaded from epoch {checkpoint.get('epoch', 'unknown')}")
            else:
                self.model.load_state_dict(checkpoint)
            
            # Move to device and set eval mode
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self.model = self.model.to(self.device)
            self.model.eval()
            
            # Define transforms - MUST match training validation transforms EXACTLY
            # Training validation pipeline from train_convnext_leukemia_classifier_NEW.py:
            #   val_transform = transforms.Compose([
            #       transforms.Resize((CONFIG['img_size'], CONFIG['img_size'])),  # 384x384
            #       adaptive_preprocessor,  # Stain norm + CLAHE + Cell detection
            #       transforms.ToTensor(),
            #       transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            #   ])
            
            # Pre-preprocessor transforms (resize to 384x384 before preprocessing)
            self.pre_transform = transforms.Compose([
                transforms.Resize((384, 384)),  # Match training: Resize to img_size
            ])
            
            # Post-preprocessor transforms (after AdaptiveCellPreprocessing)
            self.transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            
            # Initialize preprocessor - MUST MATCH TRAINING SCRIPT EXACTLY
            # Training script uses:
            #   adaptive_preprocessor = AdaptiveCellPreprocessing(
            #       target_size=CONFIG['img_size'],  # 384
            #       normalize_staining=True,
            #       detect_cell=True
            #   )
            self.preprocessor = AdaptiveCellPreprocessing(
                target_size=384,
                normalize_staining=True,
                detect_cell=True
            )
            
            print(f"ConvNeXt model ready on {self.device}")
            print(f"   Number of classes: {num_classes}")
            print(f"   Class names: {self.class_names}")
            print(f"   Preprocessing: AdaptiveCellPreprocessing (stain normalization + CLAHE + cell detection)")
            return True
            
        except Exception as e:
            print(f"Error loading ConvNeXt model: {e}")
            traceback.print_exc()
            return False
    
    def classify(self, cell_crop_pil, cell_type='WBC'):
        """
        Classify a single cell crop using ConvNeXt
        
        IMPORTANT: This function applies the same AdaptiveCellPreprocessing
        that was used during training to ensure consistent classification.
        
        Pipeline matches train_convnext_leukemia_classifier_NEW.py val_transform:
        1. Resize to (384, 384)
        2. AdaptiveCellPreprocessing (stain norm + CLAHE + cell detection)
        3. ToTensor + Normalize
        
        Args:
            cell_crop_pil: PIL Image of cell crop
            cell_type: 'WBC' or 'RBC'
            
        Returns:
            dict: {class: str, confidence: float, probabilities: dict, is_sickle_cell: bool}
                  or None if model not loaded
        """
        if self.model is None:
            return None
        
        try:
            # CRITICAL: Apply EXACT same preprocessing pipeline used during training
            # Training validation pipeline from train_convnext_leukemia_classifier_NEW.py:
            #   1. Resize to (384, 384)
            #   2. AdaptiveCellPreprocessing (stain normalization + CLAHE + cell detection)
            #   3. ToTensor + Normalize
            
            # Step 1: Pre-transform (resize to 384x384)
            img = self.pre_transform(cell_crop_pil)
            
            # Step 2: Apply AdaptiveCellPreprocessing (stain norm, CLAHE, cell detection)
            preprocessed_img = self.preprocessor(img)
            
            # Step 3: Final transforms (tensor, normalize)
            cell_tensor = self.transform(preprocessed_img).unsqueeze(0).to(self.device)
            
            # Get prediction
            with torch.no_grad():
                outputs = self.model(cell_tensor)
                probabilities = torch.softmax(outputs, dim=1)
                confidence, predicted_idx = torch.max(probabilities, 1)
            
            predicted_class = self.class_names[predicted_idx.item()]
            confidence_score = float(confidence.item())
            
            # Get all class probabilities
            probs_dict = {
                cls_name: float(prob) 
                for cls_name, prob in zip(self.class_names, probabilities[0].cpu().numpy())
            }
            
            # For RBC: Check specifically for Sickle Cell with HIGH confidence threshold
            is_sickle_cell = False
            sickle_cell_confidence = 0.0
            
            if cell_type == 'RBC' and self.sickle_cell_class_idx is not None:
                sickle_cell_confidence = float(probabilities[0][self.sickle_cell_class_idx].cpu().numpy())
                # Only consider it a Sickle Cell if:
                # 1. The predicted class IS Sickle Cell, AND
                # 2. The confidence is >= 95%
                is_sickle_cell = (
                    predicted_idx.item() == self.sickle_cell_class_idx and 
                    sickle_cell_confidence >= self.sickle_cell_confidence_threshold
                )
            
            return {
                'class': predicted_class,
                'confidence': confidence_score,
                'probabilities': probs_dict,
                'is_sickle_cell': is_sickle_cell,
                'sickle_cell_confidence': sickle_cell_confidence
            }
            
        except Exception as e:
            print(f"Error classifying cell: {e}")
            traceback.print_exc()
            return None
    
    def is_loaded(self):
        """Check if model is loaded and ready"""
        return self.model is not None
    
    def get_class_names(self):
        """Get list of class names"""
        return self.class_names if self.class_names else []
    
    def get_wbc_class_names(self):
        """Get only WBC class names (exclude RBC and Platelet classes)"""
        if not self.class_names:
            return []
        
        # Define non-WBC classes that should be excluded when classifying WBCs
        NON_WBC_CLASSES = {
            'rbc: normal',
            'platelet: normal', 
            'rbc: sickle cell anemia'
        }
        
        return [cls for cls in self.class_names if cls.lower() not in NON_WBC_CLASSES]
    
    def get_device(self):
        """Get device (cpu/cuda) model is running on"""
        return str(self.device) if self.device else 'cpu'


# ============================================================
# GLOBAL SINGLETON INSTANCE
# ============================================================
# Create global classifier instance
classifier = ConvNeXtClassifier()


# ============================================================
# CONVENIENCE FUNCTIONS (for backward compatibility)
# ============================================================
def load_convnext_model(model_path='best_leukemia_model.pth'):
    """
    Load ConvNeXt model (convenience wrapper)
    
    Args:
        model_path: Path to model checkpoint
        
    Returns:
        bool: True if successful
    """
    return classifier.load_model(model_path)


def classify_cell_crop(cell_crop_pil, cell_type='WBC'):
    """
    Classify cell crop (convenience wrapper)
    
    Args:
        cell_crop_pil: PIL Image of cell
        cell_type: 'WBC' or 'RBC'
        
    Returns:
        dict: Classification results
    """
    return classifier.classify(cell_crop_pil, cell_type)


def get_classifier_info():
    """
    Get information about loaded classifier
    
    Returns:
        dict: Classifier status and info
    """
    return {
        'loaded': classifier.is_loaded(),
        'class_names': classifier.get_class_names(),
        'wbc_class_names': classifier.get_wbc_class_names(),
        'device': classifier.get_device(),
        'sickle_cell_class_idx': classifier.sickle_cell_class_idx,
        'num_classes': len(classifier.get_class_names()) if classifier.is_loaded() else 0,
        'num_wbc_classes': len(classifier.get_wbc_class_names()) if classifier.is_loaded() else 0
    }
