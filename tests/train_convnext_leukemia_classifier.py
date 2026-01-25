"""
Training Script for ConvNeXt Leukemia Classification
Compares Normal PBC cells vs Leukemia types (Acute/Chronic Lymphoblastic/Myeloid)
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import transforms
from pathlib import Path
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns
from datetime import datetime
import json
from PIL import Image, ImageEnhance, ImageFilter
from collections import defaultdict
from torch.utils.data import Subset
import cv2

# Import the ConvNeXt model
from convnext_wbc_classifier import convnext_base, ConvNeXt_Base_Weights


class CellFocusedPreprocessing:
    """Preprocessing to focus on central cell structure"""
    
    def __init__(self, center_crop_ratio=0.7, apply_clahe=True, enhance_edges=True):
        """
        Args:
            center_crop_ratio: Ratio of image to keep from center (0.7 = keep center 70%)
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
        from PIL import ImageDraw
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
        
        # Create white background
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
                - 'multiclass': Normal vs ALL vs AML vs CLL vs CML (5 classes)
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
    """Trainer class for ConvNeXt leukemia classification"""
    
    def __init__(self, model, device, num_classes, class_names):
        self.model = model.to(device)
        self.device = device
        self.num_classes = num_classes
        self.class_names = class_names
        self.history = {
            'train_loss': [], 'train_acc': [],
            'val_loss': [], 'val_acc': []
        }
    
    def train_epoch(self, train_loader, criterion, optimizer):
        """Train for one epoch"""
        self.model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc='Training')
        for inputs, labels in pbar:
            inputs, labels = inputs.to(self.device), labels.to(self.device)
            
            optimizer.zero_grad()
            outputs = self.model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            
            # Gradient clipping for stability
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            optimizer.step()
            
            running_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            pbar.set_postfix({
                'loss': f'{running_loss/len(pbar):.4f}',
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
                outputs = self.model(inputs)
                loss = criterion(outputs, labels)
                
                running_loss += loss.item()
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
        
        epoch_loss = running_loss / len(val_loader)
        epoch_acc = 100. * correct / total
        return epoch_loss, epoch_acc
    
    def train(self, train_loader, val_loader, epochs, learning_rate, weight_decay=1e-4, warmup_epochs=5, label_smoothing=0.1):
        """Full training loop with warmup and label smoothing"""
        criterion = nn.CrossEntropyLoss(label_smoothing=label_smoothing)
        optimizer = optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        
        # Cosine annealing with warmup
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs - warmup_epochs)
        warmup_scheduler = optim.lr_scheduler.LinearLR(optimizer, start_factor=0.1, total_iters=warmup_epochs)
        
        best_val_acc = 0.0
        patience = 15
        patience_counter = 0
        
        for epoch in range(epochs):
            print(f'\n{"="*60}')
            print(f'Epoch {epoch+1}/{epochs}')
            print(f'{"="*60}')
            
            train_loss, train_acc = self.train_epoch(train_loader, criterion, optimizer)
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
    # Configuration
    CONFIG = {
        'data_dir': r'..\Datasets\ConvNext Single-Cell Classification',
        'classification_type': 'detailed',  # Options: 'binary', 'Detailed', 'detailed'
        'model_type': 'base',
        'img_size': 384,
        'batch_size': 16,
        'epochs': 100,
        'learning_rate': 5e-5,
        'weight_decay': 1e-5,
        'num_workers': 4,
        'use_pretrained': True,
        'warmup_epochs': 5,
        'label_smoothing': 0.1,
    }
    
    print("="*60)
    print("ConvNeXt Leukemia Classification Training")
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
    print()
    
    # Define transforms with cell-focused preprocessing
    print("Configuring cell-focused preprocessing...")
    print("  - Applying circular focus on center cells")
    print("  - Enhancing cell structures with CLAHE")
    print("  - Sharpening cell boundaries\n")
    
    # Cell-focused preprocessing
    cell_preprocessor = CellFocusedPreprocessing(
        center_crop_ratio=0.75,  # Focus on center 75% of image
        apply_clahe=True,
        enhance_edges=True
    )
    
    train_transform = transforms.Compose([
        transforms.Resize((int(CONFIG['img_size'] * 1.15), int(CONFIG['img_size'] * 1.15))),
        transforms.CenterCrop(int(CONFIG['img_size'] * 1.1)),  # Center crop to focus on middle
        cell_preprocessor,  # Apply cell-focused preprocessing
        transforms.Resize((CONFIG['img_size'], CONFIG['img_size'])),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=20),  # Reduced rotation to keep cell centered
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15, hue=0.05),
        transforms.RandomAffine(degrees=0, translate=(0.05, 0.05), scale=(0.95, 1.05)),  # Reduced to keep cell centered
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((int(CONFIG['img_size'] * 1.1), int(CONFIG['img_size'] * 1.1))),
        transforms.CenterCrop(CONFIG['img_size']),  # Center crop for validation too
        cell_preprocessor,  # Apply same preprocessing to validation
        transforms.Resize((CONFIG['img_size'], CONFIG['img_size'])),
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
    
    print(f"\nDataset Statistics:")
    print(f"  Total classes: {num_classes}")
    print(f"  Train samples: {len(train_dataset)}")
    print(f"  Val samples: {len(val_dataset)}")
    print(f"  Test samples: {len(test_dataset)}")
    print(f"\nClass names: {class_names}\n")
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=CONFIG['batch_size'], 
                            shuffle=True, num_workers=CONFIG['num_workers'])
    val_loader = DataLoader(val_dataset, batch_size=CONFIG['batch_size'], 
                          shuffle=False, num_workers=CONFIG['num_workers'])
    test_loader = DataLoader(test_dataset, batch_size=CONFIG['batch_size'], 
                           shuffle=False, num_workers=CONFIG['num_workers'])
    
    # Create model
    print(f"Creating ConvNeXt-{CONFIG['model_type'].upper()} model...")
    if CONFIG['use_pretrained']:
        model = convnext_base(weights=ConvNeXt_Base_Weights.IMAGENET1K_V1)
    else:
        model = convnext_base(weights=None)
    
    # Modify final classifier
    in_features = 1024  # ConvNeXt Base
    model.classifier[2] = nn.Linear(in_features, num_classes)
    
    print(f"Model created with {num_classes} output classes\n")
    
    # Initialize trainer
    trainer = ConvNeXtTrainer(model, device, num_classes, class_names)
    
    # Train model
    trainer.train(
        train_loader, val_loader, 
        epochs=CONFIG['epochs'], 
        learning_rate=CONFIG['learning_rate'], 
        weight_decay=CONFIG['weight_decay'],
        warmup_epochs=CONFIG['warmup_epochs'],
        label_smoothing=CONFIG['label_smoothing']
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
    print("Files saved:")
    print("  - best_leukemia_model.pth")
    print("  - leukemia_training_history.png")
    print("  - leukemia_confusion_matrix.png")
    print("  - leukemia_training_results.json")
    print("="*60)


if __name__ == '__main__':
    main()
