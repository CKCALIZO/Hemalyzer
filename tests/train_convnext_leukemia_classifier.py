"""
Enhanced Training Script for ConvNeXt Leukemia Classification
With Quality-Robust Preprocessing and Augmentation
Handles varying image quality, staining, and magnification
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, random_split
from torch.cuda.amp import autocast, GradScaler
from torchvision import transforms
from pathlib import Path
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight
import seaborn as sns
from datetime import datetime
import json
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
from collections import defaultdict
from torch.utils.data import Subset
import cv2
import io

# Import the ConvNeXt model
from convnext_wbc_classifier import convnext_base, ConvNeXt_Base_Weights


class QualityVariationAugmentation:
    """Simulate different image quality conditions"""
    
    def __init__(self, apply_prob=0.5):
        self.apply_prob = apply_prob
    
    def __call__(self, img):
        if np.random.random() < self.apply_prob:
            choice = np.random.choice(['blur', 'noise', 'compression', 'lighting'])
            
            if choice == 'blur':
                # Simulate out-of-focus images
                radius = np.random.uniform(0.5, 2.0)
                img = img.filter(ImageFilter.GaussianBlur(radius=radius))
            
            elif choice == 'noise':
                # Add Gaussian noise
                img_array = np.array(img).astype(np.float32)
                noise = np.random.normal(0, np.random.uniform(5, 15), img_array.shape)
                img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
                img = Image.fromarray(img_array)
            
            elif choice == 'compression':
                # Simulate JPEG compression artifacts
                buffer = io.BytesIO()
                quality = np.random.randint(40, 85)
                img.save(buffer, format='JPEG', quality=quality)
                buffer.seek(0)
                img = Image.open(buffer).convert('RGB')
            
            elif choice == 'lighting':
                # Simulate different lighting conditions
                enhancer = ImageEnhance.Brightness(img)
                img = enhancer.enhance(np.random.uniform(0.7, 1.3))
        
        return img


class MultiScaleTransform:
    """Apply random scaling to simulate different magnifications"""
    
    def __init__(self, base_size=384, scale_range=(0.8, 1.2)):
        self.base_size = base_size
        self.scale_range = scale_range
    
    def __call__(self, img):
        scale = np.random.uniform(*self.scale_range)
        new_size = int(self.base_size * scale)
        
        # Resize to scaled size
        img = img.resize((new_size, new_size), Image.Resampling.BILINEAR)
        
        # Crop or pad back to base_size
        if new_size > self.base_size:
            # Center crop
            left = (new_size - self.base_size) // 2
            top = (new_size - self.base_size) // 2
            img = img.crop((left, top, left + self.base_size, top + self.base_size))
        elif new_size < self.base_size:
            # Pad
            pad_size = (self.base_size - new_size) // 2
            new_img = Image.new('RGB', (self.base_size, self.base_size), (240, 240, 240))
            new_img.paste(img, (pad_size, pad_size))
            img = new_img
        
        return img


class AdaptiveCellPreprocessing:
    """Adaptive preprocessing that works across quality variations"""
    
    def __init__(self, target_size=384, normalize_staining=True, detect_cell=True):
        self.target_size = target_size
        self.normalize_staining = normalize_staining
        self.detect_cell = detect_cell
    
    def __call__(self, img):
        img_array = np.array(img)
        
        # 1. Stain normalization (critical for varying stain intensities)
        if self.normalize_staining:
            img_array = self._normalize_staining(img_array)
        
        # 2. Adaptive histogram equalization (handles varying contrast)
        img_array = self._adaptive_histogram_equalization(img_array)
        
        # 3. Cell detection and centering (handles varying backgrounds)
        if self.detect_cell:
            img_array = self._detect_and_center_cell(img_array)
        else:
            img_array = cv2.resize(img_array, (self.target_size, self.target_size))
        
        return Image.fromarray(img_array)
    
    def _normalize_staining(self, img_array):
        """Normalize H&E staining using simplified approach"""
        # Convert to float
        img_float = img_array.astype(np.float32) / 255.0
        img_float = np.maximum(img_float, 1e-6)
        
        # Convert to OD space
        od = -np.log(img_float)
        
        # Normalize based on percentiles
        od_norm = od / (np.percentile(od, 99, axis=(0, 1), keepdims=True) + 1e-6)
        od_norm = np.clip(od_norm, 0, 1)
        
        # Convert back to RGB
        img_normalized = (255 * np.exp(-od_norm)).astype(np.uint8)
        return img_normalized
    
    def _adaptive_histogram_equalization(self, img_array):
        """Apply CLAHE separately to luminance channel"""
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
            
            # Crop around cell center with padding
            pad = int(max(w, h) * 0.7) + 20
            y1 = max(0, cy - pad)
            y2 = min(img_array.shape[0], cy + pad)
            x1 = max(0, cx - pad)
            x2 = min(img_array.shape[1], cx + pad)
            
            cell_crop = img_array[y1:y2, x1:x2]
            
            # Resize to target
            cell_crop = cv2.resize(cell_crop, (self.target_size, self.target_size))
            
            return cell_crop
        
        # Fallback: just resize
        return cv2.resize(img_array, (self.target_size, self.target_size))


class TransformSubset(Dataset):
    """Subset with custom transform"""
    def __init__(self, subset, transform=None):
        self.subset = subset
        self.transform = transform
        
    def __getitem__(self, idx):
        img_path, label = self.subset.dataset.samples[self.subset.indices[idx]]
        image = Image.open(img_path).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
        
        return image, label
    
    def __len__(self):
        return len(self.subset)


class LeukemiaDataset(Dataset):

    def __init__(self, root_dir, transform=None, classification_type='binary'):
        """
        Args:
            root_dir: Base directory containing all datasets
            transform: Image transformations
            classification_type: 
                - 'binary': Normal vs Leukemia (2 classes)
                - 'multiclass': Normal vs ALL vs AML vs CLL vs CML VS SC(5 classes)
                - 'detailed': All individual cell types
        """
        self.root_dir = Path(root_dir)
        self.transform = transform
        self.classification_type = classification_type
        
        self.samples = []
        self.class_to_idx = {}
        self.idx_to_class = {}
        
        self._load_dataset()
    
    def _load_dataset(self):
        """Load all images and assign labels based on classification type"""
        
        if self.classification_type == 'binary':
            # Binary: 0=Normal, 1=Leukemia
            self.class_to_idx = {'Normal': 0, 'Leukemia': 1}
            
            # Load Normal cells (all from PBC_dataset_normal_DIB)
            normal_path = self.root_dir / "PBC_dataset_normal_DIB"
            if normal_path.exists():
                for cell_type_folder in normal_path.iterdir():
                    if cell_type_folder.is_dir():
                        for img_file in cell_type_folder.glob('*.*'):
                            if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                                self.samples.append((str(img_file), 0))  # 0 = Normal
            
            # Load Leukemia cells (all types)
            leukemia_folders = [
                "Acute lymphoblastic leukemia",
                "Acute myeloid leukemia",
                "Chronic lymphocytic leukemia",
                "Chronic myeloid leukemia"
            ]
            
            for leukemia_type in leukemia_folders:
                leukemia_path = self.root_dir / leukemia_type
                if leukemia_path.exists():
                    for cell_type_folder in leukemia_path.iterdir():
                        if cell_type_folder.is_dir():
                            for img_file in cell_type_folder.glob('*.*'):
                                if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                                    self.samples.append((str(img_file), 1))  # 1 = Leukemia
        
        elif self.classification_type == 'Detailed':
            self.class_to_idx = {
                'Normal WBC': 0,
                'Acute Lymphoblastic Leukemia': 1,
                'Acute Myeloid Leukemia': 2,
                'Chronic Lymphocytic Leukemia': 3,
                'Chronic Myeloid Leukemia': 4,
                'Normal RBC': 5,
                'Sickle Cell': 6
            }
            
            # Load Normal cells
            normal_path = self.root_dir / "PBC_dataset_normal_DIB"
            if normal_path.exists():
                for cell_type_folder in normal_path.iterdir():
                    if cell_type_folder.is_dir():
                        cell_type_name = cell_type_folder.name.lower()
                        # Separate RBCs from WBCs
                        if 'rbc' in cell_type_name or 'erythrocyte' in cell_type_name or 'red blood' in cell_type_name:
                            label = 5  # Normal RBC
                        else:
                            label = 0  # Normal WBC
                        
                        for img_file in cell_type_folder.glob('*.*'):
                            if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                                self.samples.append((str(img_file), label))
            
            # Load each leukemia type
            leukemia_mapping = {
                "Acute lymphoblastic leukemia": 1,
                "Acute myeloid leukemia": 2,
                "Chronic lymphocytic leukemia": 3,
                "Chronic myeloid leukemia": 4
            }
            
            for leukemia_type, label in leukemia_mapping.items():
                leukemia_path = self.root_dir / leukemia_type
                if leukemia_path.exists():
                    for cell_type_folder in leukemia_path.iterdir():
                        if cell_type_folder.is_dir():
                            for img_file in cell_type_folder.glob('*.*'):
                                if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                                    self.samples.append((str(img_file), label))
            
            # Load Sickle Cell Anemia
            sickle_path = self.root_dir / "Sickle Cell anemia" / "Sickle Cells"
            if sickle_path.exists():
                for img_file in sickle_path.glob('*.*'):
                    if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                        self.samples.append((str(img_file), 6))
        
        elif self.classification_type == 'detailed':
            # Detailed: Cell type + Disease status (e.g., "Basophil: Normal" vs "Basophil: CML")
            label_counter = 0
            
            # Normal cells - create "CellType: Normal" labels
            normal_path = self.root_dir / "PBC_dataset_normal_DIB"
            if normal_path.exists():
                for cell_type_folder in normal_path.iterdir():
                    if cell_type_folder.is_dir():
                        # Capitalize cell type name for consistency
                        cell_type_name = cell_type_folder.name.capitalize()
                        cell_type_lower = cell_type_folder.name.lower()
                        
                        # Handle RBCs specifically to distinguish from sickle cells
                        if 'rbc' in cell_type_lower or 'erythrocyte' in cell_type_lower or 'red blood' in cell_type_lower:
                            class_name = "RBC: Normal"
                        else:
                            class_name = f"{cell_type_name}: Normal"
                        
                        if class_name not in self.class_to_idx:
                            self.class_to_idx[class_name] = label_counter
                            label_counter += 1
                        
                        label = self.class_to_idx[class_name]
                        for img_file in cell_type_folder.glob('*.*'):
                            if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                                self.samples.append((str(img_file), label))
            
            # Leukemia cells - create "CellType: DiseaseType" labels
            leukemia_folders = {
                "Acute lymphoblastic leukemia": "ALL",
                "Acute myeloid leukemia": "AML",
                "Chronic lymphocytic leukemia": "CLL",
                "Chronic myeloid leukemia": "CML"
            }
            
            for leukemia_type, disease_abbrev in leukemia_folders.items():
                leukemia_path = self.root_dir / leukemia_type
                if leukemia_path.exists():
                    for cell_type_folder in leukemia_path.iterdir():
                        if cell_type_folder.is_dir():
                            # Capitalize cell type name for consistency
                            cell_type_name = cell_type_folder.name.capitalize()
                            class_name = f"{cell_type_name}: {disease_abbrev}"
                            
                            if class_name not in self.class_to_idx:
                                self.class_to_idx[class_name] = label_counter
                                label_counter += 1
                            
                            label = self.class_to_idx[class_name]
                            for img_file in cell_type_folder.glob('*.*'):
                                if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                                    self.samples.append((str(img_file), label))
            
            # Anemia cells - create "RBC: AnemiaType" labels
            anemia_folders = {
                "Sickle Cell anemia": "Sickle Cell Anemia"
            }
            
            for anemia_type, disease_name in anemia_folders.items():
                anemia_path = self.root_dir / anemia_type / "Sickle Cells"
                if anemia_path.exists():
                    class_name = f"RBC: {disease_name}"
                    if class_name not in self.class_to_idx:
                        self.class_to_idx[class_name] = label_counter
                        label_counter += 1
                    
                    label = self.class_to_idx[class_name]
                    for img_file in anemia_path.glob('*.*'):
                        if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                            self.samples.append((str(img_file), label))
        
        # Create reverse mapping
        self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        
        print(f"\nDataset loaded with {len(self.samples)} images")
        print(f"Number of classes: {len(self.class_to_idx)}")
        print(f"Classes: {list(self.class_to_idx.keys())}")
        
        # Print class distribution
        class_counts = defaultdict(int)
        for _, label in self.samples:
            class_counts[label] += 1
        
        print("\nClass distribution:")
        
        # Group by cell type for better visualization
        wbc_normal = []
        wbc_abnormal = []
        rbc_classes = []
        
        for class_name, idx in sorted(self.class_to_idx.items(), key=lambda x: x[1]):
            count = class_counts[idx]
            if 'RBC:' in class_name:
                rbc_classes.append((class_name, count))
            elif 'Normal' in class_name and 'RBC' not in class_name:
                wbc_normal.append((class_name, count))
            else:
                wbc_abnormal.append((class_name, count))
        
        if wbc_normal:
            print("\n  === NORMAL WBCs (from PBC_dataset_normal_DIB) ===")
            for class_name, count in wbc_normal:
                print(f"    {class_name}: {count} images")
        
        if wbc_abnormal:
            print("\n  === ABNORMAL WBCs (Leukemia Types) ===")
            for class_name, count in wbc_abnormal:
                print(f"    {class_name}: {count} images")
        
        if rbc_classes:
            print("\n  === RBCs (Separate from WBCs) ===")
            for class_name, count in rbc_classes:
                print(f"    {class_name}: {count} images")
        
        # Summary
        total_wbc = sum(c for _, c in wbc_normal) + sum(c for _, c in wbc_abnormal)
        total_rbc = sum(c for _, c in rbc_classes)
        print(f"\n  SUMMARY:")
        print(f"    Total WBC images (Normal + Abnormal): {total_wbc}")
        print(f"    Total RBC images: {total_rbc}")
        print(f"    Grand Total: {len(self.samples)}")
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        image = Image.open(img_path).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
        
        return image, label


class ConvNeXtTrainer:
    """Enhanced trainer with mixed precision and gradient accumulation"""
    
    def __init__(self, model, device, num_classes, class_names, use_mixed_precision=True):
        self.model = model.to(device)
        self.device = device
        self.num_classes = num_classes
        self.class_names = class_names
        self.use_mixed_precision = use_mixed_precision and torch.cuda.is_available()
        self.scaler = GradScaler() if self.use_mixed_precision else None
        self.history = {
            'train_loss': [], 'train_acc': [],
            'val_loss': [], 'val_acc': []
        }
    
    def train_epoch(self, train_loader, criterion, optimizer, accumulation_steps=1):
        """Train for one epoch with gradient accumulation"""
        self.model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        optimizer.zero_grad()
        pbar = tqdm(train_loader, desc='Training')
        
        for batch_idx, (inputs, labels) in enumerate(pbar):
            inputs, labels = inputs.to(self.device), labels.to(self.device)
            
            # Mixed precision training
            if self.use_mixed_precision:
                assert self.scaler is not None
                with autocast():
                    outputs = self.model(inputs)
                    loss = criterion(outputs, labels) / accumulation_steps
                
                self.scaler.scale(loss).backward()
                
                if (batch_idx + 1) % accumulation_steps == 0:
                    self.scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                    self.scaler.step(optimizer)
                    self.scaler.update()
                    optimizer.zero_grad()
            else:
                outputs = self.model(inputs)
                loss = criterion(outputs, labels) / accumulation_steps
                loss.backward()
                
                if (batch_idx + 1) % accumulation_steps == 0:
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                    optimizer.step()
                    optimizer.zero_grad()
            
            running_loss += loss.item() * accumulation_steps
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            pbar.set_postfix({
                'loss': f'{running_loss/(batch_idx+1):.4f}',
                'acc': f'{100.*correct/total:.2f}%'
            })
        
        epoch_loss = running_loss / len(train_loader)
        epoch_acc = 100. * correct / total
        return epoch_loss, epoch_acc
    
    def validate(self, val_loader, criterion):
        """Validate the model"""
        self.model.eval()
        running_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for inputs, labels in tqdm(val_loader, desc='Validation'):
                inputs, labels = inputs.to(self.device), labels.to(self.device)
                
                if self.use_mixed_precision:
                    with autocast():
                        outputs = self.model(inputs)
                        loss = criterion(outputs, labels)
                else:
                    outputs = self.model(inputs)
                    loss = criterion(outputs, labels)
                
                running_loss += loss.item()
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
        
        epoch_loss = running_loss / len(val_loader)
        epoch_acc = 100. * correct / total
        return epoch_loss, epoch_acc
    
    def train(self, train_loader, val_loader, epochs, learning_rate, weight_decay=1e-4, 
              warmup_epochs=5, label_smoothing=0.1, accumulation_steps=1, class_weights=None):
        """Full training loop with warmup and label smoothing"""
        if class_weights is not None:
            criterion = nn.CrossEntropyLoss(weight=class_weights.to(self.device), label_smoothing=label_smoothing)
        else:
            criterion = nn.CrossEntropyLoss(label_smoothing=label_smoothing)
        optimizer = optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        
        # Cosine annealing with warmup
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs - warmup_epochs)
        warmup_scheduler = optim.lr_scheduler.LinearLR(optimizer, start_factor=0.1, total_iters=warmup_epochs)
        
        best_val_acc = 0.0
        patience = 20
        patience_counter = 0
        
        for epoch in range(epochs):
            print(f'\n{"="*60}')
            print(f'Epoch {epoch+1}/{epochs}')
            print(f'{"="*60}')
            
            train_loss, train_acc = self.train_epoch(train_loader, criterion, optimizer, accumulation_steps)
            val_loss, val_acc = self.validate(val_loader, criterion)
            
            self.history['train_loss'].append(train_loss)
            self.history['train_acc'].append(train_acc)
            self.history['val_loss'].append(val_loss)
            self.history['val_acc'].append(val_acc)
            
            print(f'\nTrain Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%')
            print(f'Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%')
            print(f'Learning Rate: {optimizer.param_groups[0]["lr"]:.6f}')
            
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                self.save_checkpoint('best_leukemia_model.pth', epoch, val_acc)
                print(f'✓ New best model saved! (Val Acc: {val_acc:.2f}%)')
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f'\nEarly stopping triggered after {patience} epochs without improvement.')
                    break
            
            if epoch < warmup_epochs:
                warmup_scheduler.step()
            else:
                scheduler.step()
        
        print(f'\n{"="*60}')
        print(f'Training Complete! Best Val Acc: {best_val_acc:.2f}%')
        print(f'{"="*60}')
    
    def evaluate(self, test_loader):
        """Evaluate on test set"""
        self.model.eval()
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for inputs, labels in tqdm(test_loader, desc='Testing'):
                inputs = inputs.to(self.device)
                
                if self.use_mixed_precision:
                    with autocast():
                        outputs = self.model(inputs)
                else:
                    outputs = self.model(inputs)
                
                _, predicted = outputs.max(1)
                
                all_preds.extend(predicted.cpu().numpy())
                all_labels.extend(labels.numpy())
        
        accuracy = 100. * np.sum(np.array(all_preds) == np.array(all_labels)) / len(all_labels)
        
        print(f'\n{"="*60}')
        print(f'Test Accuracy: {accuracy:.2f}%')
        print(f'{"="*60}\n')
        
        print('\nClassification Report:')
        print(classification_report(all_labels, all_preds, target_names=self.class_names))
        
        self.plot_confusion_matrix(all_labels, all_preds)
        
        return accuracy, all_preds, all_labels
    
    def plot_confusion_matrix(self, labels, preds):
        """Plot confusion matrix"""
        cm = confusion_matrix(labels, preds)
        plt.figure(figsize=(max(10, len(self.class_names)), max(8, len(self.class_names))))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                   xticklabels=self.class_names,
                   yticklabels=self.class_names)
        plt.title('Confusion Matrix - Leukemia Classification')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.xticks(rotation=45, ha='right')
        plt.yticks(rotation=0)
        plt.tight_layout()
        plt.savefig('leukemia_confusion_matrix.png', dpi=300, bbox_inches='tight')
        print('Confusion matrix saved to: leukemia_confusion_matrix.png')
        plt.close()
    
    def plot_training_history(self):
        """Plot training history"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        ax1.plot(self.history['train_loss'], label='Train Loss')
        ax1.plot(self.history['val_loss'], label='Val Loss')
        ax1.set_xlabel('Epoch')
        ax1.set_ylabel('Loss')
        ax1.set_title('Training and Validation Loss')
        ax1.legend()
        ax1.grid(True)
        
        ax2.plot(self.history['train_acc'], label='Train Acc')
        ax2.plot(self.history['val_acc'], label='Val Acc')
        ax2.set_xlabel('Epoch')
        ax2.set_ylabel('Accuracy (%)')
        ax2.set_title('Training and Validation Accuracy')
        ax2.legend()
        ax2.grid(True)
        
        plt.tight_layout()
        plt.savefig('leukemia_training_history.png', dpi=300, bbox_inches='tight')
        print('Training history saved to: leukemia_training_history.png')
        plt.close()
    
    def save_checkpoint(self, filename, epoch, val_acc):
        """Save model checkpoint"""
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'val_acc': val_acc,
            'class_names': self.class_names,
            'num_classes': self.num_classes
        }
        torch.save(checkpoint, filename)
    
    def load_checkpoint(self, filename):
        """Load model checkpoint"""
        checkpoint = torch.load(filename, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        print(f"Loaded checkpoint from epoch {checkpoint['epoch']} with val_acc: {checkpoint['val_acc']:.2f}%")


def main():
    # Enhanced Configuration with Quality Robustness
    CONFIG = {
        'data_dir': r'..\Datasets\ConvNext Single-Cell Classification',
        'classification_type': 'detailed',  # Options: 'binary', 'Detailed', 'detailed'
        'model_type': 'base',
        'img_size': 384,
        'batch_size': 8,  # Reduced for gradient accumulation
        'epochs': 150,  # More epochs for complex augmentation
        'learning_rate': 3e-5,  # Lower LR for stability
        'weight_decay': 1e-4,  # Increased for better regularization
        'num_workers': 4,
        'use_pretrained': True,
        'warmup_epochs': 10,  # Longer warmup
        'label_smoothing': 0.15,  # More smoothing for harder task
        'use_mixed_precision': True,  # Faster training with AMP
        'gradient_accumulation_steps': 2,  # Effective batch size = 24
        'quality_aug_prob': 0.6,  # Probability of applying quality augmentation
        'use_stain_normalization': True,  # Apply stain normalization
        'use_cell_detection': True,  # Detect and center cells
    }
    
    print("="*60)
    print("ConvNeXt Quality-Robust Leukemia Classification")
    print("="*60)
    print(f"\nConfiguration:")
    for key, value in CONFIG.items():
        print(f"  {key}: {value}")
    print("\n")
    
    # Set device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Using device: {device}')
    if torch.cuda.is_available():
        print(f'GPU: {torch.cuda.get_device_name(0)}')
        print(f'Mixed Precision: {CONFIG["use_mixed_precision"]}')
    print()
    
    # Define quality-robust transforms
    print("Configuring quality-robust preprocessing...")
    print("  - Adaptive stain normalization")
    print("  - CLAHE for contrast enhancement")
    print("  - Automatic cell detection and centering")
    print("  - Multi-scale training")
    print("  - Quality variation augmentation (blur, noise, compression)")
    print()
    
    # Quality-robust preprocessing
    quality_aug = QualityVariationAugmentation(apply_prob=CONFIG['quality_aug_prob'])
    multi_scale = MultiScaleTransform(base_size=CONFIG['img_size'], scale_range=(0.8, 1.2))
    adaptive_preprocessor = AdaptiveCellPreprocessing(
        target_size=CONFIG['img_size'],
        normalize_staining=CONFIG['use_stain_normalization'],
        detect_cell=CONFIG['use_cell_detection']
    )
    
    train_transform = transforms.Compose([
        transforms.Resize((int(CONFIG['img_size'] * 1.2), int(CONFIG['img_size'] * 1.2))),
        adaptive_preprocessor,  # Adaptive preprocessing
        quality_aug,  # Quality variation
        multi_scale,  # Multi-scale training
        
        # Geometric augmentations (keep cell-focused)
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.RandomAffine(
            degrees=0, 
            translate=(0.05, 0.05), 
            scale=(0.95, 1.05),
            shear=5
        ),
        
        # Color augmentations (critical for varying stains)
        transforms.ColorJitter(
            brightness=0.25,
            contrast=0.25,
            saturation=0.2,
            hue=0.05
        ),
        
        # Advanced augmentations
        transforms.RandomApply([
            transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))
        ], p=0.3),
        
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        
        # Cutout/Random erasing (helps generalization)
        transforms.RandomErasing(p=0.3, scale=(0.02, 0.1), ratio=(0.3, 3.3)),
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((CONFIG['img_size'], CONFIG['img_size'])),
        adaptive_preprocessor,  # Same preprocessing
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Load datasets
    print("Loading dataset...")
    full_dataset = LeukemiaDataset(CONFIG['data_dir'], transform=None, 
                                   classification_type=CONFIG['classification_type'])
    
    # Split dataset
    total_size = len(full_dataset)
    train_size = int(0.8 * total_size)
    val_size = int(0.1 * total_size)
    test_size = total_size - train_size - val_size
    
    train_subset, val_subset, test_subset = random_split(
        full_dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )
    
    # Apply transforms using wrapper class
    train_dataset = TransformSubset(train_subset, transform=train_transform)
    val_dataset = TransformSubset(val_subset, transform=val_transform)
    test_dataset = TransformSubset(test_subset, transform=val_transform)
    
    num_classes = len(full_dataset.class_to_idx)
    class_names = [full_dataset.idx_to_class[i] for i in range(num_classes)]
    
    # Compute class weights for balanced training to address CML bias
    labels = [label for _, label in full_dataset.samples]
    class_weights = compute_class_weight('balanced', classes=np.arange(num_classes), y=labels)
    class_weights = torch.tensor(class_weights, dtype=torch.float)
    print(f"Computed class weights for balanced training: {class_weights}")
    
    print(f"\nDataset Statistics:")
    print(f"  Total classes: {num_classes}")
    print(f"  Train samples: {len(train_dataset)}")
    print(f"  Val samples: {len(val_dataset)}")
    print(f"  Test samples: {len(test_dataset)}")
    print(f"  Effective batch size: {CONFIG['batch_size'] * CONFIG['gradient_accumulation_steps']}")
    print(f"\nClass names: {class_names}\n")
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=CONFIG['batch_size'], 
                            shuffle=True, num_workers=CONFIG['num_workers'], 
                            pin_memory=True if torch.cuda.is_available() else False)
    val_loader = DataLoader(val_dataset, batch_size=CONFIG['batch_size'], 
                          shuffle=False, num_workers=CONFIG['num_workers'],
                          pin_memory=True if torch.cuda.is_available() else False)
    test_loader = DataLoader(test_dataset, batch_size=CONFIG['batch_size'], 
                           shuffle=False, num_workers=CONFIG['num_workers'],
                           pin_memory=True if torch.cuda.is_available() else False)
    
    # Create model
    print(f"Creating ConvNeXt-{CONFIG['model_type'].upper()} model...")
    if CONFIG['use_pretrained']:
        model = convnext_base(weights=ConvNeXt_Base_Weights.IMAGENET1K_V1)
        print("  Loaded ImageNet pre-trained weights")
    else:
        model = convnext_base(weights=None)
        print("  Training from scratch")
    
    # Modify final classifier with dropout for regularization
    in_features = 1024  # ConvNeXt Base
    model.classifier = nn.Sequential(
        model.classifier[0],
        model.classifier[1],
        nn.Dropout(0.5),  # Dropout for overfitting prevention
        nn.Linear(in_features, num_classes)
    )
    
    print(f"Model created with {num_classes} output classes\n")
    
    # Initialize trainer with mixed precision
    trainer = ConvNeXtTrainer(
        model, device, num_classes, class_names, 
        use_mixed_precision=CONFIG['use_mixed_precision']
    )
    
    # Train model
    print("Starting training with quality-robust augmentation...")
    trainer.train(
        train_loader, val_loader, 
        epochs=CONFIG['epochs'], 
        learning_rate=CONFIG['learning_rate'], 
        weight_decay=CONFIG['weight_decay'],
        warmup_epochs=CONFIG['warmup_epochs'],
        label_smoothing=CONFIG['label_smoothing'],
        accumulation_steps=CONFIG['gradient_accumulation_steps'],
        class_weights=class_weights
    )
    
    # Plot training history
    trainer.plot_training_history()
    
    # Load best model and evaluate
    print("\nLoading best model for evaluation...")
    trainer.load_checkpoint('best_leukemia_model.pth')
    
    # Evaluate on test set
    test_acc, preds, labels = trainer.evaluate(test_loader)
    
    # Save configuration and results
    results = {
        'config': CONFIG,
        'num_classes': num_classes,
        'class_names': class_names,
        'test_accuracy': test_acc,
        'training_history': trainer.history,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    with open('leukemia_training_results.json', 'w') as f:
        json.dump(results, f, indent=4)
    
    print("\n" + "="*60)
    print("Training completed successfully!")
    print("="*60)
    print("\nFiles saved:")
    print("  - best_leukemia_model.pth")
    print("  - leukemia_training_history.png")
    print("  - leukemia_confusion_matrix.png")
    print("  - leukemia_training_results.json")
    print("="*60)


if __name__ == '__main__':
    main()