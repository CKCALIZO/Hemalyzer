"""
ConvNeXt Cell Classification Module
Handles WBC and RBC classification using trained ConvNeXt model

This module includes:
- CellFocusedPreprocessing: Preprocessing pipeline matching training
- Model loading and initialization
- Cell classification with confidence thresholds
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
# CELL-FOCUSED PREPROCESSING (Matches Training Pipeline)
# ============================================================
class CellFocusedPreprocessing:
    """
    Preprocessing to focus on central cell structure.
    This MUST match the preprocessing used during ConvNeXt training.
    """
    
    def __init__(self, center_crop_ratio=0.75, apply_clahe=True, enhance_edges=True):
        """
        Args:
            center_crop_ratio: Ratio of image to keep from center (0.75 = keep center 75%)
            apply_clahe: Apply Contrast Limited Adaptive Histogram Equalization
            enhance_edges: Apply edge enhancement to make cell boundaries clearer
        """
        self.center_crop_ratio = center_crop_ratio
        self.apply_clahe = apply_clahe
        self.enhance_edges = enhance_edges
    
    def __call__(self, img):
        """Apply cell-focused preprocessing to PIL Image"""
        # Convert to numpy for processing
        img_array = np.array(img)
        
        # Apply CLAHE for better contrast on cell structures
        if self.apply_clahe:
            img_array = self._apply_clahe(img_array)
        
        # Convert back to PIL
        img = Image.fromarray(img_array)
        
        # Apply circular mask to focus on center cell
        img = self._apply_circular_focus(img, self.center_crop_ratio)
        
        # Enhance edges to make cell boundaries more prominent
        if self.enhance_edges:
            img = self._enhance_cell_edges(img)
        
        return img
    
    def _apply_clahe(self, img_array):
        """Apply CLAHE to enhance cell structures"""
        # Convert to LAB color space for better processing
        lab = cv2.cvtColor(img_array, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge back and convert to RGB
        lab = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        return enhanced
    
    def _apply_circular_focus(self, img, ratio):
        """Apply circular mask to focus on center of image where cell typically is"""
        width, height = img.size
        
        # Create circular mask
        mask = Image.new('L', (width, height), 0)
        draw = ImageDraw.Draw(mask)
        
        # Calculate circle dimensions (centered, with specified ratio)
        center_x, center_y = width // 2, height // 2
        radius = int(min(width, height) * ratio / 2)
        
        # Draw white circle (area to keep)
        draw.ellipse(
            [(center_x - radius, center_y - radius),
             (center_x + radius, center_y + radius)],
            fill=255
        )
        
        # Apply Gaussian blur to mask for smooth transition
        mask = mask.filter(ImageFilter.GaussianBlur(radius=5))
        
        # Create white/light background (matching training)
        background = Image.new('RGB', (width, height), (240, 240, 240))
        
        # Composite: use mask to blend cell (img) with background
        result = Image.composite(img, background, mask)
        
        return result
    
    def _enhance_cell_edges(self, img):
        """Enhance cell edges and structures"""
        # Enhance sharpness to make cell boundaries clearer
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5)
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.2)
        
        return img


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
        self.sickle_cell_confidence_threshold = 0.95  # 95% confidence threshold
    
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
            
            # Find Sickle Cell class index (for RBC classification with high confidence threshold)
            self.sickle_cell_class_idx = None
            for idx, name in enumerate(self.class_names):
                if 'sickle' in name.lower():
                    self.sickle_cell_class_idx = idx
                    break
            print(f"   Sickle Cell class index: {self.sickle_cell_class_idx}")
            
            # Initialize model using torchvision's ConvNeXt
            self.model = convnext_base(weights=None)
            
            # Modify classifier for the correct number of classes
            in_features = 1024  # ConvNeXt Base has 1024 features
            self.model.classifier[2] = nn.Linear(in_features, num_classes)
            
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
            # Training validation pipeline:
            #   1. Resize to (1.1x, 1.1x) = (422, 422) for 384 base
            #   2. CenterCrop to 384
            #   3. cell_preprocessor (CLAHE, circular focus, edge enhancement)
            #   4. Resize to (384, 384)
            #   5. ToTensor
            #   6. Normalize
            
            # Pre-preprocessor transforms (before cell_preprocessor)
            self.pre_transform = transforms.Compose([
                transforms.Resize((int(384 * 1.1), int(384 * 1.1))),  # Resize to 422x422
                transforms.CenterCrop(384),  # Center crop to 384
            ])
            
            # Post-preprocessor transforms (after cell_preprocessor)
            self.transform = transforms.Compose([
                transforms.Resize((384, 384)),  # Ensure final size is 384x384
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            
            # Initialize preprocessor (matches training config)
            self.preprocessor = CellFocusedPreprocessing(
                center_crop_ratio=0.75,
                apply_clahe=True,
                enhance_edges=True
            )
            
            print(f"ConvNeXt model ready on {self.device}")
            print(f"   Number of classes: {num_classes}")
            print(f"   Class names: {self.class_names}")
            return True
            
        except Exception as e:
            print(f"Error loading ConvNeXt model: {e}")
            traceback.print_exc()
            return False
    
    def classify(self, cell_crop_pil, cell_type='WBC'):
        """
        Classify a single cell crop using ConvNeXt
        
        IMPORTANT: This function applies the same CellFocusedPreprocessing
        that was used during training to ensure consistent classification.
        
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
            # Training validation pipeline:
            #   1. Resize to 1.1x (422x422 for 384 base)
            #   2. CenterCrop to 384
            #   3. cell_preprocessor (CLAHE, circular focus, edge enhancement)
            #   4. Resize to 384x384
            #   5. ToTensor + Normalize
            
            # Step 1-2: Pre-transforms (resize and center crop)
            img = self.pre_transform(cell_crop_pil)
            
            # Step 3: Apply CellFocusedPreprocessing (CLAHE, circular focus, edge enhancement)
            preprocessed_img = self.preprocessor(img)
            
            # Step 4-5: Final transforms (resize, tensor, normalize)
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
        'device': classifier.get_device(),
        'sickle_cell_class_idx': classifier.sickle_cell_class_idx,
        'num_classes': len(classifier.get_class_names()) if classifier.is_loaded() else 0
    }
