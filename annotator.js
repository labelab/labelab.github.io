// DOM Elements
const imageUpload = document.getElementById('image-upload');
const uploadCount = document.getElementById('upload-count');
const classInput = document.getElementById('class-input');
const addClassBtn = document.getElementById('add-class-btn');
const classList = document.getElementById('class-list');
const prevImageBtn = document.getElementById('prev-image-btn');
const nextImageBtn = document.getElementById('next-image-btn');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const imageCanvas = document.getElementById('image-canvas');
const noImageMessage = document.getElementById('no-image-message');
const imageName = document.getElementById('image-name');
const imageIndex = document.getElementById('image-index');
const totalImages = document.getElementById('total-images');
const currentClassSelect = document.getElementById('current-class');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const annotationsList = document.getElementById('annotations-list');

// Canvas context
const ctx = imageCanvas.getContext('2d');

// Application state
const state = {
    images: [],
    currentImageIndex: -1,
    classes: [],
    annotations: {}, // Format: { 'image_name': [{ class: 'class_name', rect: [x, y, width, height] }] }
    currentClass: '',
    isDrawing: false,      // Drawing a new box
    isDragging: false,     // Moving an existing box
    startX: 0,
    startY: 0,
    selectedAnnotationIndex: -1,
    dragOffsetX: 0,        // Offset from box corner during drag
    dragOffsetY: 0,
    canvasScale: 1,
    imageSize: { width: 0, height: 0 },
    canvasOffset: { x: 0, y: 0 }
};

// Color palette for class visualization
const colorPalette = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#d35400', '#c0392b', '#16a085', '#8e44ad',
    '#27ae60', '#2980b9', '#f1c40f', '#e67e22', '#34495e'
];

// --- Initialization and Setup ---

function init() {
    // Event listeners
    imageUpload.addEventListener('change', handleImageUpload);
    addClassBtn.addEventListener('click', addClass);
    classInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addClass();
    });
    prevImageBtn.addEventListener('click', showPreviousImage);
    nextImageBtn.addEventListener('click', showNextImage);
    exportBtn.addEventListener('click', exportLabelsZip); // Use the new ZIP export function
    resetBtn.addEventListener('click', resetApp);
    deleteSelectedBtn.addEventListener('click', deleteSelectedAnnotation);
    currentClassSelect.addEventListener('change', (e) => {
        state.currentClass = e.target.value;
        // If an annotation is selected, offer to change its class (optional feature)
        // changeSelectedAnnotationClass(state.currentClass);
    });

    // Canvas event listeners
    imageCanvas.addEventListener('mousedown', handleMouseDown);
    imageCanvas.addEventListener('mousemove', handleMouseMove);
    imageCanvas.addEventListener('mouseup', handleMouseUp);
    imageCanvas.addEventListener('mouseleave', handleMouseLeave); // Use a separate handler

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Add some default classes
    addClassWithName('person');
    addClassWithName('car');
    addClassWithName('dog');
    updateNavigationButtons();
}

// --- Image Handling ---

function handleImageUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    if (state.images.length > 0 && !confirm('Replace existing images and annotations?')) {
        return; // User cancelled replacing
    }

    // Reset state for new images
    state.images = [];
    state.annotations = {};
    state.currentImageIndex = -1;
    state.selectedAnnotationIndex = -1;

    let loadedCount = 0;
    const totalFiles = files.length;

    Array.from(files).forEach(file => {
        if (!file.type.match('image.*')) {
             console.warn(`Skipping non-image file: ${file.name}`);
             loadedCount++; // Count as "processed" even if skipped
             if (loadedCount === totalFiles) finalizeImageLoading();
             return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.images.push({
                    name: file.name,
                    element: img,
                    width: img.width,
                    height: img.height
                });
                if (!state.annotations[file.name]) {
                    state.annotations[file.name] = [];
                }
                loadedCount++;
                if (loadedCount === totalFiles) finalizeImageLoading();
            };
            img.onerror = () => {
                 console.error(`Error loading image: ${file.name}`);
                 loadedCount++;
                 if (loadedCount === totalFiles) finalizeImageLoading();
            }
            img.src = e.target.result;
        };
        reader.onerror = () => {
             console.error(`Error reading file: ${file.name}`);
             loadedCount++;
             if (loadedCount === totalFiles) finalizeImageLoading();
        }
        reader.readAsDataURL(file);
    });
}

function finalizeImageLoading() {
     updateUploadCount();
     if (state.images.length > 0) {
         state.currentImageIndex = 0;
         showCurrentImage();
     } else {
         // Handle case where no valid images were loaded
         resetAppVisuals(); // Reset UI elements
     }
     updateNavigationButtons();
}


function showPreviousImage() {
    if (state.currentImageIndex > 0) {
        state.currentImageIndex--;
        showCurrentImage();
        updateNavigationButtons();
    }
}

function showNextImage() {
    if (state.currentImageIndex < state.images.length - 1) {
        state.currentImageIndex++;
        showCurrentImage();
        updateNavigationButtons();
    }
}

function showCurrentImage() {
    if (state.currentImageIndex === -1 || state.images.length === 0) {
        resetAppVisuals();
        return;
    }

    const currentImage = state.images[state.currentImageIndex];
    imageCanvas.style.display = 'block';
    noImageMessage.style.display = 'none';
    imageName.textContent = currentImage.name;
    imageIndex.textContent = state.currentImageIndex + 1;

    // Scaling and centering logic (same as before)
    const container = document.querySelector('.canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scaleX = containerWidth / currentImage.width;
    const scaleY = containerHeight / currentImage.height;
    state.canvasScale = Math.min(scaleX, scaleY, 1);
    const scaledWidth = currentImage.width * state.canvasScale;
    const scaledHeight = currentImage.height * state.canvasScale;
    imageCanvas.width = scaledWidth;
    imageCanvas.height = scaledHeight;
    state.canvasOffset = {
        x: (containerWidth - scaledWidth) / 2,
        y: (containerHeight - scaledHeight) / 2
    };
    imageCanvas.style.left = `${state.canvasOffset.x}px`;
    imageCanvas.style.top = `${state.canvasOffset.y}px`;
    state.imageSize = { width: currentImage.width, height: currentImage.height };

    // Reset selection when changing image
    state.selectedAnnotationIndex = -1;
    state.isDrawing = false;
    state.isDragging = false;
    deleteSelectedBtn.disabled = true;

    // Draw image and annotations
    redrawCanvas();
    updateAnnotationsList();
}

function redrawCanvas() {
     if (!ctx || state.currentImageIndex === -1) return;
     const currentImage = state.images[state.currentImageIndex];

     // Clear canvas
     ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);

     // Draw the image
     ctx.drawImage(currentImage.element, 0, 0, imageCanvas.width, imageCanvas.height);

     // Draw existing annotations
     drawAnnotations();
}


// --- Class Handling ---

function addClass() {
    const className = classInput.value.trim().toLowerCase(); // Standardize to lowercase
    if (className && !state.classes.includes(className)) {
        addClassWithName(className);
        classInput.value = '';
    } else if (state.classes.includes(className)) {
         alert(`Class "${className}" already exists.`);
    }
}

function addClassWithName(className) {
    state.classes.push(className);
    updateClassList();
    updateClassSelect();
    if (state.classes.length === 1) {
        state.currentClass = className;
        currentClassSelect.value = className;
    }
}

function removeClass(className) {
    let isClassInUse = Object.values(state.annotations).flat().some(a => a.class === className);

    if (isClassInUse && !confirm(`Class "${className}" is used in annotations. Delete anyway and remove associated annotations?`)) {
        return;
    }

    // Remove class
    state.classes = state.classes.filter(c => c !== className);

    // Remove annotations with this class
    Object.keys(state.annotations).forEach(imgName => {
        state.annotations[imgName] = state.annotations[imgName].filter(a => a.class !== className);
    });

    // Update UI
    updateClassList();
    updateClassSelect();
    if (state.currentClass === className) {
        state.currentClass = state.classes.length > 0 ? state.classes[0] : '';
        currentClassSelect.value = state.currentClass;
    }
    if (state.currentImageIndex !== -1) {
        redrawCanvas();
        updateAnnotationsList();
    }
}

function updateClassList() {
    classList.innerHTML = '';
    state.classes.forEach((className, index) => {
        const color = getClassColor(className);
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <span class="class-color" style="background-color: ${color}"></span>
                ${className}
            </span>
            <span class="delete-class" data-class="${className}" title="Delete class">×</span>
        `;
        classList.appendChild(li);
        li.querySelector('.delete-class').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent li click
            removeClass(e.target.getAttribute('data-class'));
        });
         li.addEventListener('click', () => { // Select class on click
             state.currentClass = className;
             currentClassSelect.value = className;
         });
    });
}

function updateClassSelect() {
    const previousValue = currentClassSelect.value;
    currentClassSelect.innerHTML = '';
    if (state.classes.length === 0) {
        const option = document.createElement('option');
        option.textContent = "Add classes first";
        option.disabled = true;
        currentClassSelect.appendChild(option);
        state.currentClass = '';
    } else {
        state.classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            currentClassSelect.appendChild(option);
        });
        // Try to restore previous selection or default to first
        if (state.classes.includes(previousValue)) {
            currentClassSelect.value = previousValue;
            state.currentClass = previousValue;
        } else {
            currentClassSelect.value = state.classes[0];
            state.currentClass = state.classes[0];
        }
    }
}

function getClassColor(className) {
    const index = state.classes.indexOf(className);
    return colorPalette[index % colorPalette.length];
}

// --- Annotation Drawing and Handling ---

function drawAnnotations() {
    if (state.currentImageIndex === -1) return;
    const currentImage = state.images[state.currentImageIndex];
    const annotations = state.annotations[currentImage.name] || [];

    annotations.forEach((annotation, index) => {
        const isSelected = index === state.selectedAnnotationIndex;
        drawBoundingBox(
            annotation.rect[0] * state.canvasScale,
            annotation.rect[1] * state.canvasScale,
            annotation.rect[2] * state.canvasScale,
            annotation.rect[3] * state.canvasScale,
            annotation.class,
            isSelected
        );
    });
}

function drawBoundingBox(x, y, width, height, className, isSelected) {
    const color = getClassColor(className);
    const strokeColor = isSelected ? color : color;
    const strokeWidth = isSelected ? 3 : 2;

    // Create a slightly transparent fill for all boxes
    const fillAlpha = isSelected ? 0.25 : 0.1;
    const fillColor = `${color}${Math.floor(fillAlpha * 255).toString(16).padStart(2, '0')}`;

    // Draw semi-transparent fill
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);

    // Draw rounded rectangle border - looks more modern
    drawRoundedRect(x, y, width, height, strokeColor, strokeWidth);

    // Draw label with better styling
    const text = className;
    ctx.font = 'bold 12px Arial';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = 18; // Increased for better readability
    const padding = 6;
    const labelX = x;
    const labelY = y > textHeight + padding ? y - textHeight - padding : y + height + padding;

    // Draw label background with rounded corners
    ctx.fillStyle = color;
    drawRoundedRect(labelX, labelY, textWidth + padding * 2, textHeight, color, 0, true);

    // Draw label text
    ctx.fillStyle = '#fff';
    ctx.fillText(text, labelX + padding, labelY + textHeight - padding/2);

    if (isSelected) {
        // Draw resize handles at corners
        drawSelectionHandles(x, y, width, height);
    }
}


// Helper function to draw a rounded rectangle
function drawRoundedRect(x, y, width, height, color, lineWidth = 2, fill = false) {
    const radius = 3; // Corner radius
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) {
        ctx.fill();
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

// Draw selection handles at corners of selected box
function drawSelectionHandles(x, y, width, height) {
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    const handleColor = "#ffffff";
    const borderColor = "#000000";

    // Corner positions
    const corners = [
        {x: x, y: y},                           // Top-left
        {x: x + width, y: y},                   // Top-right
        {x: x + width, y: y + height},          // Bottom-right
        {x: x, y: y + height}                   // Bottom-left
    ];

    corners.forEach(corner => {
        // White fill with black border
        ctx.fillStyle = handleColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.rect(corner.x - halfHandle, corner.y - halfHandle, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    });
}

// --- Mouse Event Handlers ---

function handleMouseDown(e) {
    if (state.currentImageIndex === -1) return;

    const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
    const currentImageName = state.images[state.currentImageIndex].name;
    const annotations = state.annotations[currentImageName] || [];

    // Check if clicking on an existing annotation
    let clickedAnnotationIndex = -1;
    for (let i = annotations.length - 1; i >= 0; i--) {
        const [ax, ay, aw, ah] = annotations[i].rect;
        const scaledRect = {
            x: ax * state.canvasScale,
            y: ay * state.canvasScale,
            width: aw * state.canvasScale,
            height: ah * state.canvasScale
        };
        if (isMouseOverRect(mouseX, mouseY, scaledRect)) {
            clickedAnnotationIndex = i;
            break;
        }
    }

    if (clickedAnnotationIndex !== -1) {
        // Clicked on existing annotation
        state.selectedAnnotationIndex = clickedAnnotationIndex;
        state.isDragging = true;
        state.isDrawing = false; // Prevent drawing new box
        const selectedRect = annotations[clickedAnnotationIndex].rect;
        // Calculate offset from top-left corner for smooth dragging
        state.dragOffsetX = mouseX - (selectedRect[0] * state.canvasScale);
        state.dragOffsetY = mouseY - (selectedRect[1] * state.canvasScale);
        deleteSelectedBtn.disabled = false;
        imageCanvas.style.cursor = 'move';
    } else {
        // Start drawing a new annotation if a class is selected
        if (!state.currentClass) {
             alert("Please select a class before drawing.");
             return;
        }
        state.isDrawing = true;
        state.isDragging = false;
        state.startX = mouseX;
        state.startY = mouseY;
        state.selectedAnnotationIndex = -1; // Deselect any previous
        deleteSelectedBtn.disabled = true;
        imageCanvas.style.cursor = 'crosshair';
    }

    redrawCanvas(); // Redraw to show selection/prepare for drawing
    updateAnnotationsList();
}

function handleMouseMove(e) {
    const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);

    if (state.isDragging && state.selectedAnnotationIndex !== -1) {
        // Move the selected annotation
        const currentImageName = state.images[state.currentImageIndex].name;
        const annotation = state.annotations[currentImageName][state.selectedAnnotationIndex];
        let newX = (mouseX - state.dragOffsetX) / state.canvasScale;
        let newY = (mouseY - state.dragOffsetY) / state.canvasScale;

        // Optional: Keep box within image boundaries
        newX = Math.max(0, Math.min(newX, state.imageSize.width - annotation.rect[2]));
        newY = Math.max(0, Math.min(newY, state.imageSize.height - annotation.rect[3]));

        annotation.rect[0] = newX;
        annotation.rect[1] = newY;
        redrawCanvas(); // Redraw continuously while dragging
    } else if (state.isDrawing) {
        // Draw the temporary rectangle for a new annotation
        redrawCanvas(); // Redraw base image + existing annotations
        const width = mouseX - state.startX;
        const height = mouseY - state.startY;
        ctx.strokeStyle = getClassColor(state.currentClass) || '#0000ff'; // Color of current class
        ctx.lineWidth = 2;
        ctx.strokeRect(state.startX, state.startY, width, height);
    } else {
         // Update cursor if hovering over an existing box (when not dragging/drawing)
         updateCursorStyle(mouseX, mouseY);
    }
}

function handleMouseUp(e) {
    if (state.isDrawing) {
        // Finish drawing a new annotation
        const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
        const width = mouseX - state.startX;
        const height = mouseY - state.startY;

        if (Math.abs(width) > 5 && Math.abs(height) > 5) { // Minimum size check
            const currentImageName = state.images[state.currentImageIndex].name;
            const x = Math.min(state.startX, mouseX) / state.canvasScale;
            const y = Math.min(state.startY, mouseY) / state.canvasScale;
            const w = Math.abs(width) / state.canvasScale;
            const h = Math.abs(height) / state.canvasScale;

            // Clamp coordinates to image boundaries
            const clampedX = Math.max(0, x);
            const clampedY = Math.max(0, y);
            const clampedW = Math.min(w, state.imageSize.width - clampedX);
            const clampedH = Math.min(h, state.imageSize.height - clampedY);


            if (clampedW > 0 && clampedH > 0) {
                 state.annotations[currentImageName].push({
                     class: state.currentClass,
                     rect: [clampedX, clampedY, clampedW, clampedH]
                 });
                 state.selectedAnnotationIndex = state.annotations[currentImageName].length - 1;
                 deleteSelectedBtn.disabled = false;
            }
        }
    }

    // Reset states
    state.isDrawing = false;
    state.isDragging = false;
    imageCanvas.style.cursor = 'default'; // Reset cursor
    redrawCanvas(); // Final redraw
    updateAnnotationsList();
}

function handleMouseLeave(e) {
    // If drawing or dragging was in progress, cancel it or finalize it
    if (state.isDrawing || state.isDragging) {
        handleMouseUp(e); // Treat leaving the canvas like releasing the mouse
    }
     imageCanvas.style.cursor = 'default';
}


function updateCursorStyle(mouseX, mouseY) {
     if (state.currentImageIndex === -1 || state.isDragging || state.isDrawing) return; // Don't change if busy

     const currentImageName = state.images[state.currentImageIndex].name;
     const annotations = state.annotations[currentImageName] || [];
     let hoveringOverBox = false;

     for (let i = annotations.length - 1; i >= 0; i--) {
         const [ax, ay, aw, ah] = annotations[i].rect;
         const scaledRect = {
             x: ax * state.canvasScale,
             y: ay * state.canvasScale,
             width: aw * state.canvasScale,
             height: ah * state.canvasScale
         };
         if (isMouseOverRect(mouseX, mouseY, scaledRect)) {
             hoveringOverBox = true;
             break;
         }
     }

     if (hoveringOverBox) {
         imageCanvas.style.cursor = 'move'; // Indicate movability
     } else {
         imageCanvas.style.cursor = state.currentClass ? 'crosshair' : 'default'; // Crosshair if class selected
     }
}


function isMouseOverRect(mouseX, mouseY, rect) {
    return mouseX >= rect.x && mouseX <= rect.x + rect.width &&
           mouseY >= rect.y && mouseY <= rect.y + rect.height;
}


// --- Annotation List and Deletion ---

function updateAnnotationsList() {
    annotationsList.innerHTML = '';
    if (state.currentImageIndex === -1) return;

    const currentImage = state.images[state.currentImageIndex];
    const annotations = state.annotations[currentImage.name] || [];

    if (annotations.length === 0) {
        annotationsList.innerHTML = '<li>No annotations yet</li>';
        return;
    }

    annotations.forEach((annotation, index) => {
        const color = getClassColor(annotation.class);
        const li = document.createElement('li');
        li.className = index === state.selectedAnnotationIndex ? 'selected' : '';
        li.innerHTML = `
            <span class="annotation-info">
                <span class="annotation-class-indicator" style="background-color: ${color}"></span>
                <select class="annotation-class-selector" data-index="${index}">
                    ${state.classes.map(c => `<option value="${c}" ${c === annotation.class ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </span>
            <span class="annotation-size">${Math.round(annotation.rect[2])}×${Math.round(annotation.rect[3])}</span>
        `;

        // Click on list item selects the annotation
        li.addEventListener('click', (e) => {
             // Don't select if click was on the dropdown
             if (e.target.tagName !== 'SELECT') {
                 state.selectedAnnotationIndex = index;
                 deleteSelectedBtn.disabled = false;
                 redrawCanvas();
                 updateAnnotationsList(); // Re-render list to show selection
             }
        });

        // Change class using the dropdown
        const selector = li.querySelector('.annotation-class-selector');
        selector.addEventListener('change', (e) => {
             const newClass = e.target.value;
             const annotationIndex = parseInt(e.target.getAttribute('data-index'));
             state.annotations[currentImage.name][annotationIndex].class = newClass;
             state.selectedAnnotationIndex = annotationIndex; // Keep it selected
             redrawCanvas();
             updateAnnotationsList(); // Update list appearance
        });
         // Prevent clicks on select box from bubbling up to the li's click handler
         selector.addEventListener('click', (e) => e.stopPropagation());


        annotationsList.appendChild(li);
    });
}

function deleteSelectedAnnotation() {
    if (state.selectedAnnotationIndex === -1 || state.currentImageIndex === -1) return;

    const currentImage = state.images[state.currentImageIndex];
    if (!state.annotations[currentImage.name]) return;

    state.annotations[currentImage.name].splice(state.selectedAnnotationIndex, 1);
    state.selectedAnnotationIndex = -1;
    deleteSelectedBtn.disabled = true;
    redrawCanvas();
    updateAnnotationsList();
}

// --- Keyboard Shortcuts ---

function handleKeyDown(e) {
    // Use e.key for modern browsers
    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault(); // Prevent browser back navigation if input isn't focused
            showPreviousImage();
            break;
        case 'ArrowRight':
            e.preventDefault(); // Prevent browser forward navigation
            showNextImage();
            break;
        case 'Delete':
        case 'Backspace':
             if (state.selectedAnnotationIndex !== -1 && !deleteSelectedBtn.disabled) {
                 e.preventDefault(); // Prevent browser back navigation
                 deleteSelectedAnnotation();
             }
            break;
         // Add more shortcuts (e.g., number keys to select class) if needed
    }
}


// --- Export ---

// Uses JSZip to export all annotations into a single zip file
async function exportLabelsZip() {
    if (state.images.length === 0) {
        alert("No images to export annotations for.");
        return;
    }
    if (state.classes.length === 0) {
         alert("Please define classes before exporting.");
         return;
    }

    // Check if JSZip is loaded
    if (typeof JSZip === 'undefined') {
         alert("Error: JSZip library not loaded. Cannot export as ZIP.");
         console.error("JSZip library not found. Make sure it's included in your HTML.");
         return;
    }

    const zip = new JSZip();
    let annotationsGenerated = false;

    // Add annotation files
    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return; // Skip images with no annotations

        let yoloContent = '';
        annotations.forEach(annotation => {
            const classIndex = state.classes.indexOf(annotation.class);
            if (classIndex === -1) return; // Should not happen if removeClass logic is correct

             // Skip annotations with invalid dimensions right away
             if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
                console.warn(`Skipping invalid annotation for ${imageName}:`, annotation);
                return;
             }

            const [x, y, width, height] = annotation.rect;
            const centerX = (x + width / 2) / imageObj.width;
            const centerY = (y + height / 2) / imageObj.height;
            const normWidth = width / imageObj.width;
            const normHeight = height / imageObj.height;

            // Clamp values just in case
            const clamp = (val) => Math.max(0, Math.min(1, val));
            yoloContent += `${classIndex} ${clamp(centerX).toFixed(6)} ${clamp(centerY).toFixed(6)} ${clamp(normWidth).toFixed(6)} ${clamp(normHeight).toFixed(6)}\n`;
        });

        if (yoloContent) {
             const txtFileName = imageName.replace(/\.[^/.]+$/, "") + ".txt";
             zip.file(txtFileName, yoloContent);
             annotationsGenerated = true;
        }
    });

    if (!annotationsGenerated) {
        alert("No annotations found to export.");
        return;
    }

    // Add classes.txt file
    const classesContent = state.classes.join('\n');
    zip.file("classes.txt", classesContent);

    // Generate and download the zip file
    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "yolo_annotations.zip");
        alert('Annotations successfully exported as yolo_annotations.zip!');
    } catch (error) {
        console.error("Error generating ZIP file:", error);
        alert("Failed to generate ZIP file. Check console for details.");
    }
}

// Helper function to download a Blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Free up memory
}

// --- Utility Functions ---

function updateNavigationButtons() {
    prevImageBtn.disabled = state.currentImageIndex <= 0;
    nextImageBtn.disabled = state.currentImageIndex >= state.images.length - 1 || state.images.length === 0;
    exportBtn.disabled = state.images.length === 0; // Enable export if images are loaded
}

function updateUploadCount() {
    uploadCount.textContent = `${state.images.length} image${state.images.length !== 1 ? 's' : ''} loaded`;
    totalImages.textContent = state.images.length;
}

function resetApp() {
    if (state.images.length > 0 || Object.keys(state.annotations).length > 0) {
        if (!confirm('Are you sure you want to reset? All images and annotations will be lost.')) {
            return;
        }
    }
    // Reset state completely
    state.images = [];
    state.currentImageIndex = -1;
    // state.classes = []; // Keep classes or reset? Let's keep them for now.
    state.annotations = {};
    state.selectedAnnotationIndex = -1;
    state.isDrawing = false;
    state.isDragging = false;

    resetAppVisuals();
    updateNavigationButtons();
    // updateClassList(); // Update in case classes were reset
    // updateClassSelect();
}

function resetAppVisuals() {
     if (ctx) ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
     imageCanvas.style.display = 'none';
     noImageMessage.style.display = 'block';
     uploadCount.textContent = 'No images loaded';
     imageName.textContent = 'None';
     imageIndex.textContent = '0';
     totalImages.textContent = '0';
     deleteSelectedBtn.disabled = true;
     annotationsList.innerHTML = '';
     imageCanvas.style.cursor = 'default';
}


function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

// Convert canvas coordinates to original image coordinates
// function canvasToImageCoords(x, y) { ... } // Not currently used but keep if needed

// Convert original image coordinates to canvas coordinates
// function imageToCanvasCoords(x, y) { ... } // Not currently used but keep if needed

// --- Start the application ---
document.addEventListener('DOMContentLoaded', init);