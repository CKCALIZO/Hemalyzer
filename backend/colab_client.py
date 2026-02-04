"""
Colab Model Client Module
Handles communication with the ConvNeXt classifier running on Google Colab via ngrok.

This module is used when COLAB_MODEL_URL environment variable is set,
indicating the model should be accessed remotely instead of locally.
"""

import os
import requests
import base64
from io import BytesIO
from PIL import Image
import time
import json

# Configuration
COLAB_MODEL_URL = os.environ.get('COLAB_MODEL_URL', '')
COLAB_API_KEY = os.environ.get('COLAB_API_KEY', 'hemalyzer-colab-2024')
REQUEST_TIMEOUT = 90  # seconds - increased for Colab GPU processing


class ColabModelClient:
    """Client for communicating with the Colab-hosted model API"""
    
    def __init__(self, base_url=None, api_key=None):
        self.base_url = (base_url or COLAB_MODEL_URL).rstrip('/')
        self.api_key = api_key or COLAB_API_KEY
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        })
        self._model_info_cache = None
        self._last_health_check = 0
        self._is_healthy = False
    
    def is_available(self):
        """Check if the Colab model URL is configured"""
        return bool(self.base_url)
    
    def health_check(self, force=False):
        """
        Check if the Colab model server is healthy.
        Caches result for 30 seconds unless force=True.
        """
        if not self.is_available():
            return False
        
        # Use cached result if recent
        if not force and time.time() - self._last_health_check < 30:
            return self._is_healthy
        
        try:
            response = self.session.get(
                f"{self.base_url}/health",
                timeout=10
            )
            self._is_healthy = response.status_code == 200
            self._last_health_check = time.time()
            
            if self._is_healthy:
                data = response.json()
                self._is_healthy = data.get('model_loaded', False)
                
            return self._is_healthy
            
        except Exception as e:
            print(f"[ColabClient] Health check failed: {e}")
            self._is_healthy = False
            return False
    
    def get_model_info(self):
        """Get information about the loaded model"""
        if not self.is_available():
            return None
        
        if self._model_info_cache:
            return self._model_info_cache
        
        try:
            response = self.session.get(
                f"{self.base_url}/model_info",
                timeout=10
            )
            if response.status_code == 200:
                self._model_info_cache = response.json()
                return self._model_info_cache
        except Exception as e:
            print(f"[ColabClient] Failed to get model info: {e}")
        
        return None
    
    def _image_to_base64(self, image):
        """Convert PIL Image or numpy array to base64 string"""
        if isinstance(image, str):
            # Already base64 or path
            if image.startswith('data:'):
                return image.split(',')[1] if ',' in image else image
            return image
        
        # Convert numpy array to PIL Image
        if hasattr(image, 'shape'):
            import numpy as np
            if isinstance(image, np.ndarray):
                image = Image.fromarray(image)
        
        # Convert PIL Image to base64
        if isinstance(image, Image.Image):
            buffer = BytesIO()
            image.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return image
    
    def classify_cell(self, image, cell_type='WBC'):
        """
        Classify a single cell image using the Colab model.
        
        Args:
            image: PIL Image, numpy array, or base64 string
            cell_type: 'WBC' or 'RBC'
        
        Returns:
            dict: Classification result with keys:
                - classification: str
                - confidence: float
                - is_sickle_cell: bool (for RBC)
                - sickle_confidence: float
                - error: str (if failed)
        """
        if not self.is_available():
            return {'error': 'Colab model URL not configured'}
        
        try:
            image_b64 = self._image_to_base64(image)
            
            response = self.session.post(
                f"{self.base_url}/classify",
                json={
                    'image': image_b64,
                    'cell_type': cell_type
                },
                timeout=REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                return {'error': 'Unauthorized - check API key'}
            else:
                return {'error': f'Server error: {response.status_code}'}
                
        except requests.exceptions.Timeout:
            return {'error': 'Request timeout - Colab server may be slow'}
        except requests.exceptions.ConnectionError:
            return {'error': 'Connection failed - check if Colab notebook is running'}
        except Exception as e:
            return {'error': f'Classification failed: {str(e)}'}
    
    def classify_batch(self, images, cell_types=None, chunk_size=20):
        """
        Classify a batch of cell images.
        Automatically chunks large batches to prevent timeout and payload size issues.
        
        Args:
            images: List of PIL Images, numpy arrays, or base64 strings
            cell_types: List of cell types ('WBC' or 'RBC') for each image
            chunk_size: Maximum images per request (default: 20)
        
        Returns:
            list: List of classification results
        """
        if not self.is_available():
            return [{'error': 'Colab model URL not configured'}] * len(images)
        
        if cell_types is None:
            cell_types = ['WBC'] * len(images)
        
        # For large batches, split into chunks to prevent timeout/payload issues
        if len(images) > chunk_size:
            print(f"   [Colab] Splitting {len(images)} images into chunks of {chunk_size}")
            all_results = []
            for i in range(0, len(images), chunk_size):
                chunk_images = images[i:i+chunk_size]
                chunk_types = cell_types[i:i+chunk_size]
                print(f"   [Colab] Processing chunk {i//chunk_size + 1}/{(len(images) + chunk_size - 1)//chunk_size} ({len(chunk_images)} images)")
                chunk_results = self._classify_batch_chunk(chunk_images, chunk_types)
                all_results.extend(chunk_results)
            return all_results
        
        return self._classify_batch_chunk(images, cell_types)
    
    def _classify_batch_chunk(self, images, cell_types):
        """Internal method to classify a single chunk of images"""
        try:
            images_b64 = [self._image_to_base64(img) for img in images]
            
            response = self.session.post(
                f"{self.base_url}/classify_batch",
                json={
                    'images': images_b64,
                    'cell_types': cell_types
                },
                timeout=REQUEST_TIMEOUT * 3  # 180 seconds for batch
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('results', [])
            elif response.status_code == 401:
                return [{'error': 'Unauthorized - check API key'}] * len(images)
            else:
                return [{'error': f'Server error: {response.status_code}'}] * len(images)
                
        except requests.exceptions.Timeout:
            print(f"   [Colab] Timeout processing {len(images)} images")
            return [{'error': 'Request timeout'}] * len(images)
        except requests.exceptions.ConnectionError:
            print(f"   [Colab] Connection failed processing {len(images)} images")
            return [{'error': 'Connection failed'}] * len(images)
        except Exception as e:
            print(f"   [Colab] Error processing {len(images)} images: {e}")
            return [{'error': str(e)}] * len(images)


# Global client instance
colab_client = ColabModelClient()


def is_colab_mode():
    """Check if the application should use Colab model"""
    return colab_client.is_available() and colab_client.health_check()


def classify_cell_remote(image, cell_type='WBC'):
    """Convenience function to classify a cell using the Colab model"""
    return colab_client.classify_cell(image, cell_type)


def classify_batch_remote(images, cell_types=None):
    """Convenience function to classify a batch using the Colab model"""
    return colab_client.classify_batch(images, cell_types)


# Test connection on import
if COLAB_MODEL_URL:
    print(f"[ColabClient] Configured with URL: {COLAB_MODEL_URL}")
    if colab_client.health_check():
        print("[ColabClient] Connection successful!")
    else:
        print("[ColabClient] Warning: Could not connect to Colab server")
