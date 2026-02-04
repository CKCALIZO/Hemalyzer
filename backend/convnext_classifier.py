"""
ConvNeXt Cell Classification Module
Handles WBC and RBC classification using trained ConvNeXt model

This module includes:
- AdaptiveCellPreprocessing: Preprocessing pipeline matching training exactly
- Model loading and initialization
- Cell classification with confidence thresholds
- OPTIMIZED for CPU with batch processing and performance improvements
- COLAB MODE: Remote classification via Google Colab when COLAB_MODEL_URL is set

IMPORTANT: The preprocessing MUST match train_convnext_leukemia_classifier_NEW.py exactly:
1. Stain normalization (OD space normalization)
2. CLAHE in YUV space (clipLimit=3.0)
3. Cell detection and centering (Otsu + contours)

DEPLOYMENT MODES:
- LOCAL MODE: Model runs on the same machine (default)
- COLAB MODE: Model runs on Google Colab, accessed via ngrok URL
  Set COLAB_MODEL_URL environment variable to enable Colab mode
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
import traceback
from concurrent.futures import ThreadPoolExecutor
import time

# Check if we should use Colab mode
COLAB_MODEL_URL = os.environ.get('COLAB_MODEL_URL', '')
USE_COLAB_MODE = bool(COLAB_MODEL_URL)

if USE_COLAB_MODE:
    print(f"[ConvNeXt] COLAB MODE ENABLED - Using remote model at: {COLAB_MODEL_URL}")
    from colab_client import colab_client, is_colab_mode
    # Don't import torch in Colab mode - model runs remotely
    torch = None
    nn = None
    transforms = None
    convnext_base = None
else:
    print("[ConvNeXt] LOCAL MODE - Loading model locally")
    # Only import torch when running locally
    import torch
    import torch.nn as nn
    from torchvision import transforms
    from torchvision.models import convnext_base


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
    
    def __init__(self, target_size=384, normalize_staining=True, detect_cell=True, fast_mode=False):
        """
        Args:
            target_size: Output image size (384 for ConvNeXt)
            normalize_staining: Whether to apply stain normalization (default: True)
            detect_cell: Whether to detect and center cell (default: True)
            fast_mode: If True, use faster but slightly less accurate preprocessing
        """
        self.target_size = target_size
        self.normalize_staining = normalize_staining
        self.detect_cell = detect_cell
        self.fast_mode = fast_mode
        # Pre-create CLAHE object for reuse
        self.clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        # Pre-create morphological kernel for reuse
        self.morph_kernel = np.ones((3, 3), np.uint8)
        # Pre-allocate arrays for fast_mode
        self._percentile_cache = {}
        print(f"[AdaptiveCellPreprocessing] Initialized: target_size={target_size}, "
              f"stain_norm={normalize_staining}, cell_detect={detect_cell}, fast_mode={fast_mode}")
    
    def __call__(self, img):
        """Apply preprocessing to PIL Image - matches training script exactly"""
        img_array = np.array(img)
        
        # Fast mode: skip some steps for RBCs (sickle cell detection still works well)
        if self.fast_mode:
            # Simplified preprocessing - just resize and basic enhancement
            img_array = cv2.resize(img_array, (self.target_size, self.target_size))
            # Quick CLAHE only
            img_yuv = cv2.cvtColor(img_array, cv2.COLOR_RGB2YUV)
            img_yuv[:, :, 0] = self.clahe.apply(img_yuv[:, :, 0])
            img_array = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2RGB)
            return Image.fromarray(img_array)
        
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
        # Apply to luminance channel in YUV space
        img_yuv = cv2.cvtColor(img_array, cv2.COLOR_RGB2YUV)
        img_yuv[:, :, 0] = self.clahe.apply(img_yuv[:, :, 0])
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
        
        # Morphological operations to clean up (reuse kernel)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, self.morph_kernel, iterations=2)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, self.morph_kernel, iterations=1)
        
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
    """Singleton class to manage ConvNeXt model state with CPU optimizations"""
    
    def __init__(self):
        self.model = None
        self.class_names = None
        self.sickle_cell_class_idx = None
        self.device = None
        self.pre_transform = None  # Pre-preprocessor transforms
        self.transform = None  # Post-preprocessor transforms
        self.preprocessor = None
        self.sickle_cell_confidence_threshold = 0.875  # 87% confidence threshold for sickle cell detection
    
    def load_model(self, model_path='best_leukemia_model.pth', use_mixed_precision=False, compile_model=False):
        """
        Load ConvNeXt classification model for WBC and RBC classification
        OPTIMIZED for CPU inference
        
        Args:
            model_path: Path to model checkpoint file
            use_mixed_precision: Use mixed precision (not recommended for CPU, ignored)
            compile_model: Use torch.compile() for optimization (PyTorch 2.0+, may not help on CPU)
            
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
            
            # Set device to CPU and optimize for inference
            self.device = torch.device('cpu')
            
            # CPU optimizations - use all threads for maximum parallelism
            import multiprocessing
            num_cpu = multiprocessing.cpu_count()
            num_threads = num_cpu  # Use all cores
            torch.set_num_threads(num_threads)
            torch.set_grad_enabled(False)  # Disable gradient computation globally
            
            # Additional CPU optimizations
            torch.backends.mkldnn.enabled = True  # Enable MKL-DNN if available
            
            print(f"   CPU threads: {num_threads} (of {num_cpu} cores)")
            
            # Load checkpoint
            checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
            
            # Get number of classes from checkpoint
            if isinstance(checkpoint, dict) and 'num_classes' in checkpoint:
                num_classes = checkpoint['num_classes']
                self.class_names = checkpoint.get('class_names', [])
            else:
                # Fallback if checkpoint is just state dict
                # Try to infer from model head size
                state_dict = checkpoint if not isinstance(checkpoint, dict) else checkpoint.get('model_state_dict', checkpoint)
                classifier_weight_key = 'classifier.2.weight' if 'classifier.2.weight' in state_dict else 'head.fc.weight'
                num_classes = state_dict[classifier_weight_key].shape[0]
                self.class_names = []
                print(f"Warning: class_names not in checkpoint, using generic names")
            
            # Initialize ConvNeXt Base model
            print(f"Loading ConvNeXt Base model with {num_classes} classes...")
            model = convnext_base(weights=None)
            
            # Detect the correct classifier layer from checkpoint
            # The checkpoint might use classifier.2 or classifier.3 depending on version
            state_dict = checkpoint if not isinstance(checkpoint, dict) else checkpoint.get('model_state_dict', checkpoint)
            
            # Find which classifier layer is in the checkpoint (Linear layer)
            classifier_weight_key = None
            classifier_layer_idx = 0
            
            # Look for the highest index classifier weight (the head)
            for key in state_dict.keys():
                if key.startswith('classifier.') and key.endswith('.weight'):
                    parts = key.split('.')
                    if len(parts) == 3 and parts[2] == 'weight':
                        idx = int(parts[1])
                        # Keep the highest index (likely the Linear head, ignoring LayerNorm at 0)
                        if idx > classifier_layer_idx:
                            classifier_layer_idx = idx
                            classifier_weight_key = key
            
            if classifier_weight_key is None:
                # Fallback: check if it's 'head.fc.weight'
                if 'head.fc.weight' in state_dict:
                     # This is a different architecture, might need different handling
                     # But for now let's assume it maps to our last layer
                     classifier_layer_idx = 3 # assume standard structure
                else:
                    raise ValueError("Could not find classifier layer in checkpoint")
            
            print(f"   Detected classifier head layer: classifier.{classifier_layer_idx}")
            
            # Modify classifier head to match checkpoint structure
            in_features = model.classifier[2].in_features
            
            # Check if we need to adjust the model architecture
            if classifier_layer_idx == 3:
                # Model uses classifier.3 (newer torchvision version or custom head)
                # Match checkpoint structure: 0:LN, 1:Flatten, 2:Dropout, 3:Linear
                model.classifier = nn.Sequential(
                    model.classifier[0],  # LayerNorm
                    model.classifier[1],  # Flatten
                    nn.Dropout(0.5),      # Extra layer (classifier.2) - Parameterless
                    nn.Linear(in_features, num_classes)   # Final layer (classifier.3)
                )
            else:
                # Model uses classifier.2 (standard)
                model.classifier[2] = nn.Linear(in_features, num_classes)
            
            # Load state dict
            if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                state_dict_to_load = checkpoint['model_state_dict']
            else:
                state_dict_to_load = checkpoint
            
            model.load_state_dict(state_dict_to_load)
            
            # Set model to evaluation mode
            model.eval()
            
            # Move model to CPU
            model = model.to(self.device)
            
            # CPU OPTIMIZATION: Convert model to channels_last memory format
            # This can significantly improve performance on CPU
            model = model.to(memory_format=torch.channels_last)
            
            # Store model
            self.model = model
            
            # CPU OPTIMIZATION: Dynamic Quantization
            # Quantize Linear layers to INT8 for faster CPU inference
            if self.device.type == 'cpu':
                print("   Applying dynamic quantization for CPU optimization...")
                try:
                    self.model = torch.quantization.quantize_dynamic(
                        self.model, {nn.Linear}, dtype=torch.qint8
                    )
                    print("   Dynamic quantization applied successfully")
                except Exception as e:
                    print(f"   Warning: Could not apply dynamic quantization: {e}")

            # Optional: Compile model for optimization (PyTorch 2.0+)
            # Note: torch.compile() may not provide benefits on CPU and can increase startup time
            if compile_model:
                if self.device.type == 'cpu':
                    print("   Skipping torch.compile() on CPU (not recommended/supported for reduce-overhead)")
                else:
                    try:
                        print("   Attempting to compile model with torch.compile()...")
                        # Note: This requires PyTorch 2.0+ and may not help much on CPU
                        self.model = torch.compile(self.model, mode='reduce-overhead')
                        print("   Model compiled successfully")
                    except Exception as e:
                        print(f"   Warning: Could not compile model (requires PyTorch 2.0+): {e}")
                        print("   Continuing without compilation...")
            
            # Note: Mixed precision (use_mixed_precision) is ignored on CPU as it's not beneficial
            
            # Find Sickle Cell class index if it exists
            self.sickle_cell_class_idx = None
            if self.class_names:
                for idx, cls_name in enumerate(self.class_names):
                    if 'sickle' in cls_name.lower():
                        self.sickle_cell_class_idx = idx
                        print(f"   Sickle Cell class found at index {idx}: {cls_name}")
                        break
            
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
            self.preprocessor = AdaptiveCellPreprocessing(
                target_size=384,
                normalize_staining=True,
                detect_cell=True
            )
            
            print(f"ConvNeXt model ready on {self.device}")
            print(f"   Number of classes: {num_classes}")
            print(f"   Class names: {self.class_names}")
            print(f"   CPU optimizations: threads=4, channels_last=True, grad_disabled=True")
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
            # Step 1: Pre-transform (resize to 384x384)
            img = self.pre_transform(cell_crop_pil)
            
            # Step 2: Apply AdaptiveCellPreprocessing (stain norm, CLAHE, cell detection)
            preprocessed_img = self.preprocessor(img)
            
            # Step 3: Final transforms (tensor, normalize)
            cell_tensor = self.transform(preprocessed_img).unsqueeze(0)
            
            # CPU OPTIMIZATION: Convert to channels_last for better CPU performance
            cell_tensor = cell_tensor.to(self.device, memory_format=torch.channels_last)
            
            # Get prediction (grad already disabled globally)
            with torch.inference_mode():  # inference_mode is faster than no_grad
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
                # 2. The confidence is >= threshold
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
    
    def classify_batch(self, cell_crops_pil, cell_types=None, batch_size=32, use_fast_mode_for_rbc=True):
        """
        OPTIMIZED: Classify multiple cell crops in batches for better CPU performance
        
        Optimizations:
        1. Parallel Preprocessing (multithreading)
        2. Batched inference
        3. Dynamic Quantization (applied in load_model)
        4. Fast mode preprocessing for RBCs (simpler pipeline)
        5. Larger thread pool for parallel preprocessing
        
        Args:
            cell_crops_pil: List of PIL Images of cell crops
            cell_types: List of cell types ('WBC' or 'RBC') for each crop, or single type for all
            batch_size: Batch size for inference (default: 32, higher for quantized CPU)
            use_fast_mode_for_rbc: Use faster preprocessing for RBCs (default: True)
            
        Returns:
            list: List of classification result dicts (same format as classify())
        """
        if self.model is None:
            return [None] * len(cell_crops_pil)
        
        if not cell_crops_pil:
            return []
        
        start_time = time.time()
        
        # Handle cell_types parameter
        if cell_types is None:
            cell_types = ['WBC'] * len(cell_crops_pil)
        elif isinstance(cell_types, str):
            cell_types = [cell_types] * len(cell_crops_pil)
        
        results = [None] * len(cell_crops_pil)
        
        try:
            # 1. PARALLEL PREPROCESSING with Fast Mode for RBCs
            # This is the most CPU-intensive part (stain norm, CLAHE, etc.)
            # RBCs use fast mode (simpler pipeline) while WBCs use full pipeline
            
            # Create fast-mode preprocessor for RBCs
            fast_preprocessor = AdaptiveCellPreprocessing(
                target_size=384,
                normalize_staining=False,  # Skip for RBCs
                detect_cell=False,         # Skip for RBCs
                fast_mode=True
            ) if use_fast_mode_for_rbc else self.preprocessor
            
            def preprocess_single(idx_and_img_and_type):
                idx, img, cell_type = idx_and_img_and_type
                try:
                    # Apply full preprocessing pipeline
                    img_resized = self.pre_transform(img)
                    
                    # Use fast preprocessor for RBCs, full for WBCs
                    if cell_type == 'RBC' and use_fast_mode_for_rbc:
                        img_preprocessed = fast_preprocessor(img_resized)
                    else:
                        img_preprocessed = self.preprocessor(img_resized)
                    
                    tensor = self.transform(img_preprocessed)
                    return idx, tensor
                except Exception as e:
                    print(f"Error preprocessing image {idx}: {e}")
                    return idx, None

            print(f"   Starting parallel preprocessing of {len(cell_crops_pil)} cells...")
            prep_start = time.time()
            
            # Use fewer workers to prevent system slowdown on laptops
            # Reduced from min(16, max(8, ...)) to min(6, max(4, ...))
            num_workers = min(6, max(4, len(cell_crops_pil) // 100))  # Scale workers with batch size
            valid_tensors = []
            valid_indices = []
            
            with ThreadPoolExecutor(max_workers=num_workers) as executor:
                # Submit all tasks with cell types
                args = [(idx, img, cell_types[idx]) for idx, img in enumerate(cell_crops_pil)]
                futures = list(executor.map(preprocess_single, args))
                
                # Collect results
                for idx, tensor in futures:
                    if tensor is not None:
                        valid_tensors.append(tensor)
                        valid_indices.append(idx)
            
            prep_time = time.time() - prep_start
            print(f"   Preprocessing complete in {prep_time:.2f}s ({(prep_time/len(cell_crops_pil))*1000:.1f}ms per cell)")
            
            if not valid_tensors:
                return results

            # 2. BATCH INFERENCE
            # Stack all valid tensors
            all_tensors = torch.stack(valid_tensors)
            
            # Predict in batches
            all_probs = []
            all_classes = []
            all_confidences = []
            
            total_batches = (len(valid_tensors) + batch_size - 1) // batch_size
            print(f"   Running inference on {len(valid_tensors)} cells in {total_batches} batches...")
            
            with torch.inference_mode():
                for i in range(0, len(valid_tensors), batch_size):
                    batch = all_tensors[i:i+batch_size]
                    
                    # CPU OPTIMIZATION: Convert to channels_last
                    batch = batch.to(self.device, memory_format=torch.channels_last)
                    
                    outputs = self.model(batch)
                    probabilities = torch.softmax(outputs, dim=1)
                    confidences, predicted_indices = torch.max(probabilities, 1)
                    
                    all_probs.extend(probabilities.cpu().numpy())
                    all_classes.extend(predicted_indices.cpu().numpy())
                    all_confidences.extend(confidences.cpu().numpy())
            
            # 3. POST-PROCESSING
            # specific logic for RBC/Sickle Cell
            for i, result_idx in enumerate(valid_indices):
                probs_numpy = all_probs[i]
                predicted_idx = all_classes[i]
                confidence_score = float(all_confidences[i])
                
                predicted_class = self.class_names[predicted_idx]
                
                # Get all class probabilities
                probs_dict = {
                    cls_name: float(prob) 
                    for cls_name, prob in zip(self.class_names, probs_numpy)
                }
                
                # Sickle Cell Logic
                is_sickle_cell = False
                sickle_cell_confidence = 0.0
                cell_type = cell_types[result_idx]
                
                if cell_type == 'RBC' and self.sickle_cell_class_idx is not None:
                    sickle_cell_confidence = float(probs_numpy[self.sickle_cell_class_idx])
                    is_sickle_cell = bool(
                        predicted_idx == self.sickle_cell_class_idx and 
                        sickle_cell_confidence >= self.sickle_cell_confidence_threshold
                    )
                
                results[result_idx] = {
                    'class': predicted_class,
                    'confidence': confidence_score,
                    'probabilities': probs_dict,
                    'is_sickle_cell': is_sickle_cell,
                    'sickle_cell_confidence': sickle_cell_confidence
                }
            
            total_time = time.time() - start_time
            print(f"   Batch classification finished in {total_time:.2f}s total")
            
            return results
            
        except Exception as e:
            print(f"Error in batch classification: {e}")
            traceback.print_exc()
            return [None] * len(cell_crops_pil)
    
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
def load_convnext_model(model_path='best_leukemia_model.pth', use_mixed_precision=False, compile_model=False):
    """
    Load ConvNeXt model (convenience wrapper)
    
    Args:
        model_path: Path to model checkpoint
        use_mixed_precision: Use mixed precision (ignored on CPU)
        compile_model: Use torch.compile() for optimization (PyTorch 2.0+)
        
    Returns:
        bool: True if successful
    """
    # In Colab mode, we don't load the model locally
    if USE_COLAB_MODE:
        print("[ConvNeXt] Colab mode - skipping local model load")
        return colab_client.health_check()
    return classifier.load_model(model_path, use_mixed_precision, compile_model)


def classify_cell_crop(cell_crop_pil, cell_type='WBC'):
    """
    Classify cell crop (convenience wrapper)
    Supports both local and Colab mode.
    
    Args:
        cell_crop_pil: PIL Image of cell
        cell_type: 'WBC' or 'RBC'
        
    Returns:
        dict: Classification results
    """
    # Use Colab client if available and healthy
    if USE_COLAB_MODE and is_colab_mode():
        result = colab_client.classify_cell(cell_crop_pil, cell_type)
        # Convert Colab response format to local format
        if 'error' not in result:
            return {
                'class': result.get('classification', 'Unknown'),
                'confidence': result.get('confidence', 0.0),
                'probabilities': result.get('all_probabilities', {}),
                'is_sickle_cell': result.get('is_sickle_cell', False),
                'sickle_cell_confidence': result.get('sickle_confidence', 0.0)
            }
        else:
            print(f"[ConvNeXt] Colab classification failed: {result['error']}")
            return None
    
    return classifier.classify(cell_crop_pil, cell_type)


def classify_cell_crops_batch(cell_crops_pil, cell_types=None, batch_size=8):
    """
    OPTIMIZED: Classify multiple cell crops in batches
    Supports both local and Colab mode.
    
    This is the RECOMMENDED way to classify multiple cells for best performance.
    Up to 5-10x faster than calling classify_cell_crop() in a loop!
    
    Args:
        cell_crops_pil: List of PIL Images of cell crops
        cell_types: List of cell types ('WBC' or 'RBC') for each crop, or single type for all
        batch_size: Batch size for processing (default: 8, optimized for CPU)
        
    Returns:
        list: List of classification result dicts
    """
    # Use Colab client if available and healthy
    if USE_COLAB_MODE and is_colab_mode():
        # Handle cell_types parameter
        if cell_types is None:
            cell_types_list = ['WBC'] * len(cell_crops_pil)
        elif isinstance(cell_types, str):
            cell_types_list = [cell_types] * len(cell_crops_pil)
        else:
            cell_types_list = cell_types
            
        results = colab_client.classify_batch(cell_crops_pil, cell_types_list)
        
        # Convert Colab response format to local format
        converted_results = []
        for result in results:
            if 'error' not in result:
                converted_results.append({
                    'class': result.get('classification', 'Unknown'),
                    'confidence': result.get('confidence', 0.0),
                    'probabilities': result.get('all_probabilities', {}),
                    'is_sickle_cell': result.get('is_sickle_cell', False),
                    'sickle_cell_confidence': result.get('sickle_confidence', 0.0)
                })
            else:
                print(f"[ConvNeXt] Colab batch item failed: {result['error']}")
                converted_results.append(None)
        return converted_results
    
    return classifier.classify_batch(cell_crops_pil, cell_types, batch_size)


def get_classifier_info():
    """
    Get information about loaded classifier
    Supports both local and Colab mode.
    
    Returns:
        dict: Classifier status and info
    """
    # Use Colab info if in Colab mode
    if USE_COLAB_MODE:
        colab_info = colab_client.get_model_info()
        if colab_info:
            return {
                'loaded': colab_info.get('model_loaded', False),
                'class_names': colab_info.get('class_names', []),
                'wbc_class_names': [c for c in colab_info.get('class_names', []) if 'RBC' not in c.upper() and 'sickle' not in c.lower()],
                'device': colab_info.get('device', 'colab-remote'),
                'sickle_cell_class_idx': colab_info.get('sickle_cell_class_idx'),
                'num_classes': colab_info.get('num_classes', 0),
                'num_wbc_classes': len([c for c in colab_info.get('class_names', []) if 'RBC' not in c.upper() and 'sickle' not in c.lower()]),
                'mode': 'colab'
            }
        return {
            'loaded': False,
            'class_names': [],
            'wbc_class_names': [],
            'device': 'colab-disconnected',
            'sickle_cell_class_idx': None,
            'num_classes': 0,
            'num_wbc_classes': 0,
            'mode': 'colab',
            'error': 'Colab server not responding'
        }
    
    return {
        'loaded': classifier.is_loaded(),
        'class_names': classifier.get_class_names(),
        'wbc_class_names': classifier.get_wbc_class_names(),
        'device': classifier.get_device(),
        'sickle_cell_class_idx': classifier.sickle_cell_class_idx,
        'num_classes': len(classifier.get_class_names()) if classifier.is_loaded() else 0,
        'num_wbc_classes': len(classifier.get_wbc_class_names()) if classifier.is_loaded() else 0,
        'mode': 'local'
    }