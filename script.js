// Global variables
let model = null;
let isModelLoading = false;
let loadAttempts = 0;
const MAX_ATTEMPTS = 3;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const browseBtn = document.getElementById('browseBtn');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const predictionsList = document.getElementById('predictionsList');

// Load MobileNet model on page load
async function loadModel() {
    if (model) return model;
    
    if (isModelLoading) {
        // Wait for existing load to complete
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (model) {
                    clearInterval(checkInterval);
                    resolve(model);
                } else if (!isModelLoading) {
                    clearInterval(checkInterval);
                    resolve(null);
                }
            }, 100);
        });
    }
    
    isModelLoading = true;
    loadAttempts++;
    
    // Show loading indicator on upload area
    let loadingText = document.getElementById('modelLoadingText');
    if (!loadingText) {
        loadingText = document.createElement('p');
        loadingText.id = 'modelLoadingText';
        uploadArea.appendChild(loadingText);
    }
    loadingText.textContent = '⏳ Loading AI model (approx 5MB)... Please wait';
    loadingText.style.color = '#667eea';
    loadingText.style.fontWeight = 'bold';
    uploadArea.style.opacity = '0.7';
    
    try {
        console.log('Loading MobileNet model... Attempt', loadAttempts);
        
        // Try loading with timeout
        const loadPromise = mobilenet.load({
            version: 1,
            alpha: 0.25  // Smaller model, faster load
        });
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Model loading timeout')), 30000);
        });
        
        model = await Promise.race([loadPromise, timeoutPromise]);
        console.log('Model loaded successfully!');
        
        // Success - remove loading indicator
        if (loadingText) loadingText.remove();
        uploadArea.style.opacity = '1';
        
        // Show success message temporarily
        const successMsg = document.createElement('p');
        successMsg.textContent = '✅ Model ready! Upload an image to start';
        successMsg.style.color = '#48bb78';
        successMsg.style.fontSize = '12px';
        successMsg.style.marginTop = '8px';
        uploadArea.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
        
        return model;
        
    } catch (error) {
        console.error('Error loading model:', error);
        
        if (loadAttempts < MAX_ATTEMPTS) {
            loadingText.textContent = `⚠️ Retrying... (Attempt ${loadAttempts + 1}/${MAX_ATTEMPTS})`;
            await new Promise(resolve => setTimeout(resolve, 2000));
            isModelLoading = false;
            return loadModel(); // Retry
        } else {
            loadingText.textContent = '❌ Failed to load AI model. Please refresh the page.';
            loadingText.style.color = '#e53e3e';
            uploadArea.style.opacity = '1';
            return null;
        }
    } finally {
        isModelLoading = false;
    }
}

// Alternative: Use a different CDN if Mobilenet fails
async function loadModelAlternative() {
    try {
        // Try loading from a different source
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
            script.onload = resolve;
            setTimeout(resolve, 5000);
        });
        
        model = await mobilenet.load();
        return model;
    } catch (error) {
        console.error('Alternative load also failed:', error);
        return null;
    }
}

// Classify an image element
async function classifyImage(imageElement) {
    // Show loading spinner
    loading.style.display = 'block';
    results.style.display = 'none';
    
    // Make sure model is loaded
    let loadedModel = await loadModel();
    
    // If still not loaded, try alternative CDN
    if (!loadedModel) {
        console.log('Trying alternative model loading...');
        loadedModel = await loadModelAlternative();
    }
    
    if (!loadedModel) {
        loading.style.display = 'none';
        alert('❌ Model failed to load. Please:\n1. Check your internet connection\n2. Refresh the page\n3. Try a different browser (Chrome/Firefox)');
        return;
    }
    
    try {
        // Run classification
        const predictions = await loadedModel.classify(imageElement);
        
        // Display results
        displayPredictions(predictions);
        
    } catch (error) {
        console.error('Classification error:', error);
        loading.style.display = 'none';
        alert('Error analyzing image. Please try another image.');
    }
}

// Display predictions in the UI
function displayPredictions(predictions) {
    // Clear previous results
    predictionsList.innerHTML = '';
    
    if (!predictions || predictions.length === 0) {
        predictionsList.innerHTML = '<div class="prediction-item">No clear prediction found. Try another image.</div>';
        loading.style.display = 'none';
        results.style.display = 'block';
        return;
    }
    
    // Add each prediction to the list
    predictions.forEach(prediction => {
        const confidencePercent = (prediction.probability * 100).toFixed(2);
        
        const item = document.createElement('div');
        item.className = 'prediction-item';
        item.innerHTML = `
            <span class="prediction-label">${prediction.className}</span>
            <span class="prediction-confidence">${confidencePercent}%</span>
        `;
        predictionsList.appendChild(item);
    });
    
    // Hide loading, show results
    loading.style.display = 'none';
    results.style.display = 'block';
}

// Handle image upload and preview
function handleImage(file) {
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPEG, PNG, etc.)');
        return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image is too large. Please upload an image under 5MB.');
        return;
    }
    
    // Create object URL for preview
    const reader = new FileReader();
    
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewContainer.style.display = 'block';
        
        // When image loads, classify it
        previewImage.onload = async function() {
            // Small delay to ensure image is fully rendered
            setTimeout(() => classifyImage(previewImage), 100);
        };
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsDataURL(file);
}

// Event: Click on upload area to browse
uploadArea.addEventListener('click', (e) => {
    // Don't trigger if clicking the browse button (handled separately)
    if (e.target === browseBtn || browseBtn.contains(e.target)) {
        return;
    }
    imageInput.click();
});

// Event: Browse button click
browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    imageInput.click();
});

// Event: File selected via input
imageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        handleImage(e.target.files[0]);
    }
});

// Event: Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#667eea';
    uploadArea.style.background = '#f5f3ff';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ccc';
    uploadArea.style.background = '#fafafa';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ccc';
    uploadArea.style.background = '#fafafa';
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleImage(file);
    }
});

// Also add a retry button to the UI
const retryBtn = document.createElement('button');
retryBtn.textContent = '🔄 Retry Loading Model';
retryBtn.style.cssText = `
    background: #48bb78;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 16px;
    font-size: 14px;
    display: none;
`;
retryBtn.onclick = async () => {
    model = null;
    loadAttempts = 0;
    retryBtn.style.display = 'none';
    await loadModel();
};
uploadArea.parentNode.insertBefore(retryBtn, uploadArea.nextSibling);

// Initialize: Load model in background when page loads
window.addEventListener('load', async () => {
    console.log('Page loaded, starting model download...');
    const loaded = await loadModel();
    if (!loaded && retryBtn) {
        retryBtn.style.display = 'block';
    }
});