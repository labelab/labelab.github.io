// DOM Elements
const imageUpload = document.getElementById('image-upload');
const uploadCount = document.getElementById('upload-count');
const classInput = document.getElementById('class-input');
const addClassBtn = document.getElementById('add-class-btn');
const classList = document.getElementById('class-list');
const prevImageBtn = document.getElementById('prev-image-btn');
const nextImageBtn = document.getElementById('next-image-btn');
const resetBtn = document.getElementById('reset-btn');
const imageCanvas = document.getElementById('image-canvas');
const noImageMessage = document.getElementById('no-image-message');
const imageName = document.getElementById('image-name');
const imageIndex = document.getElementById('image-index');
const totalImages = document.getElementById('total-images');
const currentClassSelect = document.getElementById('current-class');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const annotationsList = document.getElementById('annotations-list');
const exportFormatSelect = document.getElementById('export-format-select');
const exportSelectedBtn = document.getElementById('export-selected-btn');
const toggleSnapBtn = document.getElementById('toggle-snap-btn');
const selectToolRectBtn = document.getElementById('select-tool-rect'); // NEW from update.js
const selectToolPolyBtn = document.getElementById('select-tool-poly'); // NEW from update.js

// Canvas context
const ctx = imageCanvas.getContext('2d');

// Application state
const state = {
    images: [],
    currentImageIndex: -1,
    classes: [],
    annotations: {},
    currentClass: '',
    isDrawing: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    selectedAnnotationIndex: -1,
    dragOffsetX: 0,
    dragOffsetY: 0,
    canvasScale: 1,
    imageSize: { width: 0, height: 0 },
    canvasOffset: { x: 0, y: 0 },
    isSnappingEnabled: false,
    snapThreshold: 8,
    snapLines: [], // NEW: Store temporary snap lines [{ x1, y1, x2, y2, timestamp }, ...]
    snapLineDuration: 500, // NEW: How long snap lines stay visible (in ms)
    currentTool: 'rectangle', // NEW from update.js: 'rectangle' or 'polygon'
    isDrawingPolygon: false, // NEW from update.js: Flag if currently drawing a polygon
    currentPolygonPoints: [], // NEW from update.js: Stores points [ {x, y}, ... ] for the polygon being drawn
    lastMouseMovePos: { x: 0, y: 0 } // NEW from update.js: Store last mouse position
};

// Color palette for class visualization
const colorPalette = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#d35400', '#c0392b', '#16a085', '#8e44ad',
    '#27ae60', '#2980b9', '#f1c40f', '#e67e22', '#34495e'
];

// --- Initialization and Setup ---

function init() { // Updated init from update.js
    // Event listeners
    imageUpload.addEventListener('change', handleImageUpload);
    addClassBtn.addEventListener('click', addClass);
    classInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addClass();
    });
    prevImageBtn.addEventListener('click', showPreviousImage);
    nextImageBtn.addEventListener('click', showNextImage);
    exportSelectedBtn.addEventListener('click', handleExport);
    resetBtn.addEventListener('click', resetApp);
    deleteSelectedBtn.addEventListener('click', deleteSelectedAnnotation);
    currentClassSelect.addEventListener('change', (e) => {
        state.currentClass = e.target.value;
        updateCursorStyle(0, 0); // Update cursor when class changes
    });
    toggleSnapBtn.addEventListener('click', toggleSnapping);

    // NEW: Tool selection listeners from update.js
    selectToolRectBtn.addEventListener('click', () => selectTool('rectangle'));
    selectToolPolyBtn.addEventListener('click', () => selectTool('polygon'));

    // Canvas event listeners
    imageCanvas.addEventListener('mousedown', handleMouseDown);
    imageCanvas.addEventListener('mousemove', handleMouseMove);
    imageCanvas.addEventListener('mouseup', handleMouseUp);
    imageCanvas.addEventListener('mouseleave', handleMouseLeave);
    imageCanvas.addEventListener('dblclick', handleDoubleClick); // Added from update.js

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Add some default classes
    addClassWithName('person');
    addClassWithName('car');
    addClassWithName('dog');
    updateNavigationButtons();
    updateSnapButtonState();
    updateToolButtons(); // Added from update.js
    selectTool('rectangle'); // Start with rectangle tool selected
}


// --- Tool Selection --- (NEW Section from update.js)

function selectTool(toolName) {
    // If switching away from polygon while drawing, cancel the current polygon
    if (state.isDrawingPolygon && toolName !== 'polygon') {
        cancelCurrentPolygon();
    }

    state.currentTool = toolName;
    console.log("Tool selected:", state.currentTool); // Debug
    updateToolButtons();
    updateCursorStyle(0, 0); // Update cursor immediately
}

function updateToolButtons() {
    selectToolRectBtn.classList.toggle('active', state.currentTool === 'rectangle');
    selectToolPolyBtn.classList.toggle('active', state.currentTool === 'polygon');
}


// --- Snapping --- (Updated Section from update.js)

function toggleSnapping() {
    state.isSnappingEnabled = !state.isSnappingEnabled;
    updateSnapButtonState();
    // Clear any lingering snap lines when toggling
    state.snapLines = [];
    redrawCanvas();
}

function updateSnapButtonState() {
     toggleSnapBtn.textContent = `🧲 Snap: ${state.isSnappingEnabled ? 'ON' : 'OFF'}`;
     toggleSnapBtn.classList.toggle('active', state.isSnappingEnabled);
}

function drawSnapLines() {
    const now = Date.now();
    ctx.save(); // Save current context state
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'red'; // Distinct color for snap lines
    ctx.setLineDash([5, 5]); // Dashed lines

    // Filter out old lines and draw current ones
    state.snapLines = state.snapLines.filter(line => {
        if (now - line.timestamp < state.snapLineDuration) {
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
            ctx.stroke();
            return true; // Keep line
        }
        return false; // Remove line
    });

    ctx.restore(); // Restore context state (lineWidth, strokeStyle, lineDash)
}

function addSnapLine(x1, y1, x2, y2) {
    // Avoid adding duplicate lines rapidly
    const exists = state.snapLines.some(l => l.x1 === x1 && l.y1 === y1 && l.x2 === x2 && l.y2 === y2);
    if (!exists) {
       state.snapLines.push({ x1, y1, x2, y2, timestamp: Date.now() });
    }
}

function snapCoordinates(currentX, currentY) {
    let snappedX = currentX;
    let snappedY = currentY;
    let didSnapX = false; // Track if snapping occurred for X
    let didSnapY = false; // Track if snapping occurred for Y

    // Clear previous lines *before* calculating new ones for this move
    state.snapLines = [];

    if (!state.isSnappingEnabled || state.currentImageIndex === -1) {
        return { snappedX, snappedY };
    }

    const currentImageName = state.images[state.currentImageIndex].name;
    const annotations = state.annotations[currentImageName] || [];
    const threshold = state.snapThreshold;
    const canvasWidth = imageCanvas.width;
    const canvasHeight = imageCanvas.height;

    // --- Check against image boundaries ---
    if (Math.abs(currentX) < threshold) {
        snappedX = 0;
        didSnapX = true;
        addSnapLine(0, 0, 0, canvasHeight); // Add vertical line at left edge
    }
    if (Math.abs(currentX - canvasWidth) < threshold) {
        snappedX = canvasWidth;
        didSnapX = true;
         addSnapLine(canvasWidth, 0, canvasWidth, canvasHeight); // Add vertical line at right edge
    }
    if (Math.abs(currentY) < threshold) {
        snappedY = 0;
        didSnapY = true;
        addSnapLine(0, 0, canvasWidth, 0); // Add horizontal line at top edge
    }
    if (Math.abs(currentY - canvasHeight) < threshold) {
        snappedY = canvasHeight;
        didSnapY = true;
        addSnapLine(0, canvasHeight, canvasWidth, canvasHeight); // Add horizontal line at bottom edge
    }

    // --- Check against existing annotation edges ---
    annotations.forEach((annotation, index) => {
        // Only snap rectangles to rectangles for now (as per update.js logic)
        if (annotation.type !== 'rectangle') return;
        if (state.isDragging && index === state.selectedAnnotationIndex) return; // Don't snap to self while dragging

        const [imgX, imgY, imgW, imgH] = annotation.rect;
        const canvasAnnX = imgX * state.canvasScale;
        const canvasAnnY = imgY * state.canvasScale;
        const canvasAnnW = imgW * state.canvasScale;
        const canvasAnnH = imgH * state.canvasScale;
        const canvasAnnRight = canvasAnnX + canvasAnnW;
        const canvasAnnBottom = canvasAnnY + canvasAnnH;

        // Snap X (only if not already snapped to image boundary)
        if (!didSnapX) {
            if (Math.abs(currentX - canvasAnnX) < threshold) {
                snappedX = canvasAnnX;
                addSnapLine(canvasAnnX, 0, canvasAnnX, canvasHeight); // Vertical line
                didSnapX = true; // Prevent further X snapping for this point
            } else if (Math.abs(currentX - canvasAnnRight) < threshold) {
                snappedX = canvasAnnRight;
                addSnapLine(canvasAnnRight, 0, canvasAnnRight, canvasHeight); // Vertical line
                didSnapX = true;
            }
        }

        // Snap Y (only if not already snapped to image boundary)
         if (!didSnapY) {
            if (Math.abs(currentY - canvasAnnY) < threshold) {
                snappedY = canvasAnnY;
                addSnapLine(0, canvasAnnY, canvasWidth, canvasAnnY); // Horizontal line
                didSnapY = true; // Prevent further Y snapping for this point
            } else if (Math.abs(currentY - canvasAnnBottom) < threshold) {
                snappedY = canvasAnnBottom;
                addSnapLine(0, canvasAnnBottom, canvasWidth, canvasAnnBottom); // Horizontal line
                didSnapY = true;
            }
        }
    });

    return { snappedX, snappedY };
}


// --- Image Handling --- (Updated Section from update.js)

function handleImageUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    if (state.images.length > 0 && !confirm('Replace existing images and annotations?')) {
        return; // User cancelled replacing
    }

    state.images = [];
    state.annotations = {};
    state.currentImageIndex = -1;
    state.selectedAnnotationIndex = -1;
    state.snapLines = []; // Clear snap lines on new upload
    cancelCurrentPolygon(); // NEW: Cancel polygon drawing on new upload

    let loadedCount = 0;
    const totalFiles = files.length;

    Array.from(files).forEach(file => {
        if (!file.type.match('image.*')) {
             console.warn(`Skipping non-image file: ${file.name}`);
             loadedCount++;
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
                // Ensure an annotation array exists for this image name
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
         resetAppVisuals();
     }
     updateNavigationButtons();
}

function showPreviousImage() {
    if (state.currentImageIndex > 0) {
        cancelCurrentPolygon(); // NEW: Cancel polygon drawing
        state.currentImageIndex--;
        state.snapLines = []; // Clear snap lines when changing image
        showCurrentImage();
        updateNavigationButtons();
    }
}

function showNextImage() {
    if (state.currentImageIndex < state.images.length - 1) {
        cancelCurrentPolygon(); // NEW: Cancel polygon drawing
        state.currentImageIndex++;
        state.snapLines = []; // Clear snap lines when changing image
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

    // Scaling and centering logic
    const container = document.querySelector('.canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scaleX = containerWidth / currentImage.width;
    const scaleY = containerHeight / currentImage.height;
    state.canvasScale = Math.min(scaleX, scaleY, 1); // Limit scale to max 1
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

    // Reset interaction state
    state.selectedAnnotationIndex = -1;
    state.isDrawing = false;
    state.isDragging = false;
    deleteSelectedBtn.disabled = true;
    state.snapLines = []; // Ensure snap lines are clear for the new image
    cancelCurrentPolygon(); // NEW: Ensure polygon drawing is cancelled

    redrawCanvas();
    updateAnnotationsList();
}

function redrawCanvas() { // Updated from update.js
     if (!ctx || state.currentImageIndex === -1) return;
     const currentImage = state.images[state.currentImageIndex];

     ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
     ctx.drawImage(currentImage.element, 0, 0, imageCanvas.width, imageCanvas.height);

     drawAnnotations(); // Draw saved annotations
     drawCurrentPolygon(); // Draw polygon currently being created (if any)
     drawSnapLines(); // Draw temporary snap lines
}


// --- Class Handling ---

function addClass() {
    const className = classInput.value.trim().toLowerCase();
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
    // Set the first added class as current
    if (state.classes.length === 1) {
        state.currentClass = className;
        currentClassSelect.value = className;
    }
}

function removeClass(className) {
    // Check if the class is used in any annotation across all images
    let isClassInUse = Object.values(state.annotations).flat().some(a => a.class === className);

    if (isClassInUse && !confirm(`Class "${className}" is used in annotations. Delete anyway and remove associated annotations?`)) {
        return;
    }

    // Remove class from the list
    state.classes = state.classes.filter(c => c !== className);

    // Remove annotations associated with this class
    Object.keys(state.annotations).forEach(imgName => {
        state.annotations[imgName] = state.annotations[imgName].filter(a => a.class !== className);
    });

    // Update UI
    updateClassList();
    updateClassSelect();
    // Reset current class if the removed one was selected
    if (state.currentClass === className) {
        state.currentClass = state.classes.length > 0 ? state.classes[0] : '';
        currentClassSelect.value = state.currentClass;
    }
    // Redraw if an image is loaded
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
        // Add event listener for deleting the class
        li.querySelector('.delete-class').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent li click event
            removeClass(e.target.getAttribute('data-class'));
        });
        // Add event listener for selecting the class
         li.addEventListener('click', () => {
             state.currentClass = className;
             currentClassSelect.value = className;
             updateCursorStyle(0,0);
         });
    });
}

function updateClassSelect() { // Updated from update.js
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
    updateCursorStyle(0,0); // Update cursor based on potentially changed class
}


function getClassColor(className) {
    const index = state.classes.indexOf(className);
    return colorPalette[index % colorPalette.length];
}


// --- Annotation Drawing and Handling --- (Updated/New Functions from update.js)

function drawAnnotations() { // Updated from update.js
    if (state.currentImageIndex === -1) return;
    const currentImage = state.images[state.currentImageIndex];
    const annotations = state.annotations[currentImage.name] || [];

    annotations.forEach((annotation, index) => {
        const isSelected = index === state.selectedAnnotationIndex;
        // Check annotation type
        if (annotation.type === 'rectangle') {
            drawBoundingBox(
                annotation.rect[0] * state.canvasScale,
                annotation.rect[1] * state.canvasScale,
                annotation.rect[2] * state.canvasScale,
                annotation.rect[3] * state.canvasScale,
                annotation.class,
                isSelected
            );
        } else if (annotation.type === 'polygon') {
            drawPolygon(annotation.points, annotation.class, isSelected);
        }
    });
}

function drawBoundingBox(x, y, width, height, className, isSelected) {
    const color = getClassColor(className);
    const strokeColor = isSelected ? color : color;
    const strokeWidth = isSelected ? 3 : 2;

    // Slightly transparent fill
    const fillAlpha = isSelected ? 0.25 : 0.1;
    const fillColor = `${color}${Math.floor(fillAlpha * 255).toString(16).padStart(2, '0')}`;

    // Draw filled rectangle
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);

    // Draw rounded rectangle border
    drawRoundedRect(x, y, width, height, strokeColor, strokeWidth);

    // Draw class label above or below the box
    const text = className;
    ctx.font = 'bold 12px Arial';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = 18; // Height of the label background
    const padding = 6; // Padding inside the label background
    const labelX = x;
    // Position label above unless it goes off-screen, then position below
    const labelY = y > textHeight + padding ? y - textHeight - padding/2 : y + height + padding/2;

    // Draw label background
    ctx.fillStyle = color;
    drawRoundedRect(labelX, labelY, textWidth + padding * 2, textHeight, color, 0, true);

    // Draw label text
    ctx.fillStyle = '#fff'; // White text
    ctx.fillText(text, labelX + padding, labelY + textHeight - padding);

    // Draw selection handles if selected
    if (isSelected) {
        drawSelectionHandles(x, y, width, height);
    }
}

function drawPolygon(points, className, isSelected, isDrawing = false) { // NEW from update.js
    if (!points || points.length < 1) return;

    const color = getClassColor(className);
    const strokeColor = color;
    const strokeWidth = isSelected ? 3 : 2;
    const fillAlpha = isSelected ? 0.25 : 0.1;
    const fillColor = `${color}${Math.floor(fillAlpha * 255).toString(16).padStart(2, '0')}`;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.fillStyle = fillColor;

    ctx.beginPath();
    // Scale points from image space to canvas space
    ctx.moveTo(points[0].x * state.canvasScale, points[0].y * state.canvasScale);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * state.canvasScale, points[i].y * state.canvasScale);
    }

    // If not just drawing points, close the path and fill
    if (!isDrawing || points.length > 2) {
        ctx.closePath();
        ctx.fill(); // Fill the polygon area
    }
    // Always stroke the path
    ctx.stroke();

    // Draw small circles at vertices for visibility
    ctx.fillStyle = strokeColor;
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * state.canvasScale, p.y * state.canvasScale, 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Draw label (similar to bounding box) - position near first point
    if (points.length > 0 && !isDrawing) {
        const text = className;
        ctx.font = 'bold 12px Arial';
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 18;
        const padding = 6;
        const labelX = points[0].x * state.canvasScale;
        const labelY = (points[0].y * state.canvasScale) - textHeight - padding > 0 ?
                       (points[0].y * state.canvasScale) - textHeight - padding/2 :
                       (points[0].y * state.canvasScale) + padding/2 ;

        ctx.fillStyle = color;
        drawRoundedRect(labelX, labelY, textWidth + padding * 2, textHeight, color, 0, true);

        ctx.fillStyle = '#fff';
        ctx.fillText(text, labelX + padding, labelY + textHeight - padding);
    }

     // TODO: Add selection handles for polygons
     // if (isSelected && !isDrawing) { ... }

    ctx.restore();
}

function drawCurrentPolygon() { // NEW from update.js
    if (!state.isDrawingPolygon || state.currentPolygonPoints.length === 0) return;

    // Draw the points and lines connecting them
    drawPolygon(state.currentPolygonPoints, state.currentClass || 'polygon', false, true);

    // Draw the line from the last point to the current mouse position
    const lastPoint = state.currentPolygonPoints[state.currentPolygonPoints.length - 1];
    const { x: mouseX, y: mouseY } = state.lastMouseMovePos || {x:0, y:0}; // Use stored mouse pos

    ctx.save();
    ctx.strokeStyle = getClassColor(state.currentClass || 'polygon');
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]); // Dashed line for the preview segment

    ctx.beginPath();
    ctx.moveTo(lastPoint.x * state.canvasScale, lastPoint.y * state.canvasScale);
    ctx.lineTo(mouseX, mouseY); // Draw to current mouse coords (already in canvas space)
    ctx.stroke();

    // Optional: Highlight starting point if mouse is close enough to close
    if (state.currentPolygonPoints.length > 1) {
        const startPoint = state.currentPolygonPoints[0];
        const distToStart = Math.hypot(mouseX - (startPoint.x * state.canvasScale), mouseY - (startPoint.y * state.canvasScale));
        if (distToStart < 10) { // 10px threshold
            ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // Greenish circle
            ctx.beginPath();
            ctx.arc(startPoint.x * state.canvasScale, startPoint.y * state.canvasScale, 6, 0, 2 * Math.PI); // Larger circle
            ctx.fill();
        }
    }

    ctx.restore();
}


function cancelCurrentPolygon() { // NEW from update.js
    if (state.isDrawingPolygon) {
        console.log("Cancelling polygon drawing");
        state.isDrawingPolygon = false;
        state.currentPolygonPoints = [];
        redrawCanvas(); // Redraw to remove partial polygon
        updateCursorStyle(0,0); // Reset cursor
    }
}

function canvasToImageCoords(canvasX, canvasY) { // NEW from update.js
    // Basic conversion, needs refinement if zoom/pan is added
    return {
        x: canvasX / state.canvasScale,
        y: canvasY / state.canvasScale
    };
}


function drawRoundedRect(x, y, width, height, color, lineWidth = 2, fill = false) {
    const radius = 3; // Radius for rounded corners
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
        ctx.fillStyle = color;
        ctx.fill();
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}


function drawSelectionHandles(x, y, width, height) {
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    const handleColor = "#ffffff"; // White fill
    const borderColor = "#000000"; // Black border

    const corners = [
        {x: x, y: y},                           // Top-left
        {x: x + width, y: y},                   // Top-right
        {x: x + width, y: y + height},       // Bottom-right
        {x: x, y: y + height}                // Bottom-left
    ];

    corners.forEach(corner => {
        ctx.fillStyle = handleColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(corner.x - halfHandle, corner.y - halfHandle, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    });
}

// --- Mouse Event Handlers --- (Updated Section from update.js)

function handleMouseDown(e) {
    if (state.currentImageIndex === -1) return;
    if (e.button !== 0) return; // Only handle left clicks

    const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
    const currentImageName = state.images[state.currentImageIndex].name;
    const annotations = state.annotations[currentImageName] || [];

    state.snapLines = []; // Clear previous snap lines

    // --- Tool Logic ---
    if (state.currentTool === 'rectangle') {
        // --- Rectangle Mode ---
        cancelCurrentPolygon(); // Ensure polygon mode is off

        let clickedAnnotationIndex = -1;
        for (let i = annotations.length - 1; i >= 0; i--) {
            // Only interact with rectangles in rectangle mode for now
             if (annotations[i].type === 'rectangle') {
                 const [ax, ay, aw, ah] = annotations[i].rect;
                 const scaledRect = { x: ax * state.canvasScale, y: ay * state.canvasScale, width: aw * state.canvasScale, height: ah * state.canvasScale };
                 if (isMouseOverRect(mouseX, mouseY, scaledRect)) {
                     clickedAnnotationIndex = i;
                     break;
                 }
            }
        }

        if (clickedAnnotationIndex !== -1) {
            // Start dragging existing rectangle
            state.selectedAnnotationIndex = clickedAnnotationIndex;
            state.isDragging = true;
            state.isDrawing = false;
            const selectedRect = annotations[clickedAnnotationIndex].rect;
            state.dragOffsetX = mouseX - (selectedRect[0] * state.canvasScale);
            state.dragOffsetY = mouseY - (selectedRect[1] * state.canvasScale);
            deleteSelectedBtn.disabled = false;
            imageCanvas.style.cursor = 'move';
        } else {
            // Start drawing new rectangle
            if (!state.currentClass) { alert("Please select a class first."); return; }
            state.isDrawing = true;
            state.isDragging = false;
            const { snappedX, snappedY } = snapCoordinates(mouseX, mouseY);
            state.startX = snappedX;
            state.startY = snappedY;
            state.selectedAnnotationIndex = -1;
            deleteSelectedBtn.disabled = true;
            imageCanvas.style.cursor = 'crosshair';
            redrawCanvas(); // Show potential start snap lines
        }

    } else if (state.currentTool === 'polygon') {
        // --- Polygon Mode ---
        state.isDrawing = false; // Ensure rectangle drawing is off
        state.isDragging = false; // Polygon dragging not implemented

        if (!state.currentClass) { alert("Please select a class first."); return; }

        // If not currently drawing a polygon, start a new one
        if (!state.isDrawingPolygon) {
             state.isDrawingPolygon = true;
             state.currentPolygonPoints = [];
             state.selectedAnnotationIndex = -1; // Deselect any previous annotation
             deleteSelectedBtn.disabled = true;
             console.log("Starting new polygon");
        }

        // Add point to the current polygon (snap the point being added)
        const { snappedX: snappedMouseX, snappedY: snappedMouseY } = snapCoordinates(mouseX, mouseY);
        const { x: imgX, y: imgY } = canvasToImageCoords(snappedMouseX, snappedMouseY); // Store points in image space
        state.currentPolygonPoints.push({ x: imgX, y: imgY });
        console.log("Added point:", { imgX, imgY });

        // Check if clicked near the start point to close the polygon (if more than 2 points exist)
        if (state.currentPolygonPoints.length > 2) {
            const startPoint = state.currentPolygonPoints[0];
            // Use snapped coords for distance check as well
            const distToStart = Math.hypot(snappedMouseX - (startPoint.x * state.canvasScale), snappedMouseY - (startPoint.y * state.canvasScale));
            if (distToStart < 10) { // 10px threshold
                console.log("Closing polygon by clicking start point.");
                // Remove the last point added (which is the click on the start point)
                state.currentPolygonPoints.pop();
                finishCurrentPolygon();
                return; // Exit early after finishing
            }
        }

         // Redraw to show the new point and preview line (and snap lines)
         redrawCanvas();
    }

    updateAnnotationsList(); // Update list selection if needed
}

function handleMouseMove(e) {
    if (state.currentImageIndex === -1) return;

    const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
    // Store last mouse position for polygon preview line
    state.lastMouseMovePos = { x: mouseX, y: mouseY };

    // --- Tool Logic ---
    if (state.currentTool === 'rectangle') {
        // --- Rectangle Mode ---
        if (state.isDragging && state.selectedAnnotationIndex !== -1) {
            // Dragging rectangle
            const currentImageName = state.images[state.currentImageIndex].name;
            const annotation = state.annotations[currentImageName][state.selectedAnnotationIndex];
             if (annotation.type !== 'rectangle') return; // Should not happen

            let potentialCanvasX = mouseX - state.dragOffsetX;
            let potentialCanvasY = mouseY - state.dragOffsetY;
            const { snappedX: snappedCanvasX, snappedY: snappedCanvasY } = snapCoordinates(potentialCanvasX, potentialCanvasY);
            let newX = snappedCanvasX / state.canvasScale;
            let newY = snappedCanvasY / state.canvasScale;
            // Ensure dragged box stays within image bounds
            newX = Math.max(0, Math.min(newX, state.imageSize.width - annotation.rect[2]));
            newY = Math.max(0, Math.min(newY, state.imageSize.height - annotation.rect[3]));
            annotation.rect[0] = newX;
            annotation.rect[1] = newY;
            redrawCanvas(); // Redraw includes snap lines

        } else if (state.isDrawing) {
            // Drawing new rectangle
            const { snappedX: snappedMouseX, snappedY: snappedMouseY } = snapCoordinates(mouseX, mouseY);
            redrawCanvas(); // Redraw base + existing annotations + snap lines
            const width = snappedMouseX - state.startX;
            const height = snappedMouseY - state.startY;
            // Draw temporary rectangle outline
            ctx.strokeStyle = getClassColor(state.currentClass) || '#0000ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([]); // Solid line for temp box
            ctx.strokeRect(state.startX, state.startY, width, height);
            ctx.setLineDash([5, 5]); // Restore default dash
        } else {
            // Hovering in rectangle mode
            updateCursorStyle(mouseX, mouseY);
            // Clear snap lines if just hovering
            if (state.snapLines.length > 0) { state.snapLines = []; redrawCanvas(); }
        }
    } else if (state.currentTool === 'polygon') {
        // --- Polygon Mode ---
         updateCursorStyle(mouseX, mouseY); // Update cursor (e.g., crosshair, or pointer near start)
        if (state.isDrawingPolygon) {
            // Snap the current mouse position for the preview line end point
             const { snappedX: snappedMouseX, snappedY: snappedMouseY } = snapCoordinates(mouseX, mouseY);
             state.lastMouseMovePos = { x: snappedMouseX, y: snappedMouseY }; // Update stored pos with snapped value
            // Redraw to update the preview line (ending at snapped position) and show snap lines
             redrawCanvas();
        } else {
           // Clear snap lines if just hovering
           if (state.snapLines.length > 0) { state.snapLines = []; redrawCanvas(); }
        }
    }
}


function handleMouseUp(e) {
    if (e.button !== 0) return; // Only left clicks

    state.snapLines = []; // Clear snap lines on mouse up

    if (state.currentTool === 'rectangle') {
        // --- Rectangle Mode ---
        if (state.isDrawing) {
            const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
            // Snap the final corner
            const { snappedX: snappedMouseX, snappedY: snappedMouseY } = snapCoordinates(mouseX, mouseY);
            state.snapLines = []; // Clear again after final snap calc

            const finalCanvasWidth = snappedMouseX - state.startX;
            const finalCanvasHeight = snappedMouseY - state.startY;

            // Only add annotation if the box has a minimum size
            if (Math.abs(finalCanvasWidth) > 5 && Math.abs(finalCanvasHeight) > 5) {
                const currentImageName = state.images[state.currentImageIndex].name;

                // Calculate coordinates in canvas space, ensuring positive width/height
                const canvasX = Math.min(state.startX, snappedMouseX);
                const canvasY = Math.min(state.startY, snappedMouseY);
                const canvasW = Math.abs(finalCanvasWidth);
                const canvasH = Math.abs(finalCanvasHeight);

                // Convert to image space
                const x = canvasX / state.canvasScale;
                const y = canvasY / state.canvasScale;
                const w = canvasW / state.canvasScale;
                const h = canvasH / state.canvasScale;

                // Clamp coordinates to image boundaries
                const clampedX = Math.max(0, x);
                const clampedY = Math.max(0, y);
                const clampedW = Math.min(w, state.imageSize.width - clampedX);
                const clampedH = Math.min(h, state.imageSize.height - clampedY);


                if (clampedW > 0 && clampedH > 0) {
                     state.annotations[currentImageName].push({
                         type: 'rectangle', // Add type explicitly
                         class: state.currentClass,
                         rect: [clampedX, clampedY, clampedW, clampedH]
                     });
                     // Select the newly added annotation
                     state.selectedAnnotationIndex = state.annotations[currentImageName].length - 1;
                     deleteSelectedBtn.disabled = false;
                }
            }
        }
    } else if (state.currentTool === 'polygon') {
        // --- Polygon Mode ---
        // Mouse up doesn't add points or finish polygon here
    }

    // Reset flags common to both modes
    state.isDrawing = false;
    state.isDragging = false;
    // Don't reset isDrawingPolygon here
    imageCanvas.style.cursor = 'default';
    redrawCanvas(); // Final redraw without snap lines or temp box
    updateAnnotationsList();
}

function handleDoubleClick(e) { // NEW from update.js
     if (state.currentTool === 'polygon' && state.isDrawingPolygon) {
         if (state.currentPolygonPoints.length > 2) { // Need at least 3 points
              console.log("Finishing polygon via double click.");
              finishCurrentPolygon();
         } else {
              console.log("Need at least 3 points to finish polygon. Cancelling.");
              cancelCurrentPolygon();
         }
     }
}

function finishCurrentPolygon() { // NEW from update.js
    if (!state.isDrawingPolygon || state.currentPolygonPoints.length < 3) {
        cancelCurrentPolygon(); // Not enough points, just cancel
        return;
    }

    const currentImageName = state.images[state.currentImageIndex].name;
    // Add the completed polygon to the main annotations list
    // Ensure points are clamped to image boundaries
    const clampedPoints = state.currentPolygonPoints.map(p => ({
         x: Math.max(0, Math.min(state.imageSize.width, p.x)),
         y: Math.max(0, Math.min(state.imageSize.height, p.y))
    }));

    state.annotations[currentImageName].push({
        type: 'polygon',
        class: state.currentClass,
        points: clampedPoints // Use clamped points
    });

    // Select the new polygon
    state.selectedAnnotationIndex = state.annotations[currentImageName].length - 1;
    deleteSelectedBtn.disabled = false; // Allow deletion

    // Reset polygon drawing state
    state.isDrawingPolygon = false;
    state.currentPolygonPoints = [];

    console.log("Polygon saved:", state.annotations[currentImageName][state.selectedAnnotationIndex]);

    // Update UI
    redrawCanvas();
    updateAnnotationsList();
    updateCursorStyle(0, 0); // Reset cursor
}


function handleMouseLeave(e) {
     state.snapLines = []; // Clear snap lines when mouse leaves canvas

    if (state.currentTool === 'rectangle') {
        if (state.isDrawing || state.isDragging) {
            // If drawing or dragging a rectangle, finalize it as if mouse up occurred
            handleMouseUp(e);
        } else {
           // Just redraw to remove any potential lingering snap lines if only hovering
           redrawCanvas();
        }
    } else if (state.currentTool === 'polygon') {
         // Don't cancel polygon drawing on mouse leave
         // Just redraw to remove preview line and snap lines
         redrawCanvas();
    }
     // Reset cursor to default when leaving canvas
     imageCanvas.style.cursor = 'default';
}


function updateCursorStyle(mouseX, mouseY) { // Updated from update.js
     if (state.currentImageIndex === -1) { imageCanvas.style.cursor = 'default'; return; }

      // 1. Cursor during active operations (takes priority)
      if (state.isDragging) { imageCanvas.style.cursor = 'move'; return; }
      if (state.isDrawing && state.currentTool === 'rectangle') { imageCanvas.style.cursor = 'crosshair'; return; }
      if (state.isDrawingPolygon) {
           // Check if near start point for closing
           if (state.currentPolygonPoints.length > 1) {
                const startPoint = state.currentPolygonPoints[0];
                const distToStart = Math.hypot(mouseX - (startPoint.x * state.canvasScale), mouseY - (startPoint.y * state.canvasScale));
                if (distToStart < 10) {
                    imageCanvas.style.cursor = 'pointer'; // Indicate closable point
                    return;
                }
           }
           imageCanvas.style.cursor = 'crosshair'; // Default polygon drawing cursor
           return;
      }

     // 2. Cursor when hovering (no active operation)
     const currentImageName = state.images[state.currentImageIndex].name;
     const annotations = state.annotations[currentImageName] || [];
     let hoveringOverAnnotation = false;
     let hoverAnnotationType = null;

     // Check hover over existing annotations
     for (let i = annotations.length - 1; i >= 0; i--) {
          const annotation = annotations[i];
          if (annotation.type === 'rectangle') {
              const [ax, ay, aw, ah] = annotation.rect;
              const scaledRect = { x: ax*state.canvasScale, y: ay*state.canvasScale, width: aw*state.canvasScale, height: ah*state.canvasScale };
              if (isMouseOverRect(mouseX, mouseY, scaledRect)) {
                  hoveringOverAnnotation = true;
                  hoverAnnotationType = 'rectangle';
                  break;
              }
          } else if (annotation.type === 'polygon') {
              // TODO: Add isMouseOverPolygon check
              // For now, polygons aren't draggable/interactive via hover
          }
     }

     // Set cursor based on hover and selected tool
     if (hoveringOverAnnotation && hoverAnnotationType === 'rectangle' && state.currentTool === 'rectangle') {
         imageCanvas.style.cursor = 'move'; // Allow dragging rectangles only in rectangle mode
     } else {
         // Default cursor depends on the selected tool and if a class is selected
         if (state.currentTool === 'rectangle') {
             imageCanvas.style.cursor = state.currentClass ? 'crosshair' : 'default';
         } else if (state.currentTool === 'polygon') {
              imageCanvas.style.cursor = state.currentClass ? 'crosshair' : 'default';
         } else {
             imageCanvas.style.cursor = 'default';
         }
     }
}


function isMouseOverRect(mouseX, mouseY, rect) {
    return mouseX >= rect.x && mouseX <= rect.x + rect.width &&
           mouseY >= rect.y && mouseY <= rect.y + rect.height;
}

// TODO: function isMouseOverPolygon(mouseX, mouseY, polygonPoints) { ... }


// --- Annotation List and Deletion --- (Updated Section from update.js)

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

        // Display different info based on type
        let details = '';
        if (annotation.type === 'rectangle') {
            details = `Rect (${Math.round(annotation.rect[2])}×${Math.round(annotation.rect[3])})`;
        } else if (annotation.type === 'polygon') {
            details = `Poly (${annotation.points.length} pts)`;
        } else {
             details = 'Unknown'; // Should not happen if type is always set
        }

        li.innerHTML = `
            <span class="annotation-info">
                <span class="annotation-class-indicator" style="background-color: ${color}"></span>
                <select class="annotation-class-selector" data-index="${index}">
                    ${state.classes.map(c => `<option value="${c}" ${c === annotation.class ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </span>
            <span class="annotation-size">${details}</span>
        `;

        // Click on list item selects the annotation
        li.addEventListener('click', (e) => {
             // Don't select if clicking the dropdown
             if (e.target.tagName !== 'SELECT') {
                 state.selectedAnnotationIndex = index;
                 // Enable delete button (even for polygons)
                 deleteSelectedBtn.disabled = false;
                 // Visual feedback primarily for rectangles currently
                 redrawCanvas();
                 updateAnnotationsList(); // Update list highlighting
             }
        });

        // Handle class change via dropdown in the list
        const selector = li.querySelector('.annotation-class-selector');
        selector.addEventListener('change', (e) => {
             const newClass = e.target.value;
             const annotationIndex = parseInt(e.target.getAttribute('data-index'));
             state.annotations[currentImage.name][annotationIndex].class = newClass;
             // Keep the annotation selected after changing class
             state.selectedAnnotationIndex = annotationIndex;
             redrawCanvas();
             updateAnnotationsList(); // Update list text/color
        });
         // Prevent list item click when clicking the select dropdown
         selector.addEventListener('click', (e) => e.stopPropagation());


        annotationsList.appendChild(li);
    });
}

function deleteSelectedAnnotation() {
    if (state.selectedAnnotationIndex === -1 || state.currentImageIndex === -1) return;

    const currentImage = state.images[state.currentImageIndex];
    if (!state.annotations[currentImage.name]) return;

    // If currently drawing a polygon, cancel it before deleting anything
    cancelCurrentPolygon();

    // Remove the selected annotation
    state.annotations[currentImage.name].splice(state.selectedAnnotationIndex, 1);
    state.selectedAnnotationIndex = -1; // Deselect
    deleteSelectedBtn.disabled = true; // Disable delete button
    redrawCanvas();
    updateAnnotationsList();
}

// --- Keyboard Shortcuts --- (Updated Section from update.js)

function handleKeyDown(e) {
    // Ignore shortcuts if focus is on the class input field
    if (document.activeElement === classInput) {
        return;
    }

    // Add Escape key to cancel polygon drawing
    if (e.key === 'Escape') {
         if (state.isDrawingPolygon) {
            e.preventDefault();
            cancelCurrentPolygon();
            console.log("Polygon cancelled via Escape key");
            return; // Stop further processing
         } else if (state.selectedAnnotationIndex !== -1) {
             // Escape can also deselect the current annotation
              e.preventDefault();
              state.selectedAnnotationIndex = -1;
              deleteSelectedBtn.disabled = true;
              redrawCanvas();
              updateAnnotationsList();
              return;
         }
    }


    switch (e.key) {
        case 'ArrowLeft':
            // Navigate to previous image (if not holding Ctrl/Meta)
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                showPreviousImage();
            }
            break;
        case 'ArrowRight':
             // Navigate to next image (if not holding Ctrl/Meta)
             if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                showNextImage();
             }
            break;
        case 'Delete':
        case 'Backspace':
             // Delete selected annotation
             if (state.selectedAnnotationIndex !== -1 && !deleteSelectedBtn.disabled) {
                 e.preventDefault();
                 deleteSelectedAnnotation();
             }
            break;
         case 's': // Toggle Snap
              if (!e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  toggleSnapping();
              }
              break;
         case 'r': // Select Rectangle tool
              if (!e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  selectTool('rectangle');
              }
              break;
         case 'p': // Select Polygon tool
              if (!e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  selectTool('polygon');
              }
              break;
         // Allow finishing polygon with Enter? (Could be confusing)
         // case 'Enter':
         //    if (state.isDrawingPolygon && state.currentPolygonPoints.length > 2) {
         //        e.preventDefault();
         //        finishCurrentPolygon();
         //    }
         //    break;
    }
}

// --- Export --- (Updated Section from update.js - Includes Warnings)

// Helper to escape XML characters
function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}


// Generate Pascal VOC XML content for a single image (Handles Rectangles Only)
function generatePascalVOC(imageObj, annotations, classes) {
    const imageName = imageObj.name;
    const imageWidth = imageObj.width;
    const imageHeight = imageObj.height;
    let hasPolygons = false;
    let objectCount = 0;

    let xmlContent = `<annotation>
    <folder>images</folder>
    <filename>${escapeXml(imageName)}</filename>
    <path>${escapeXml(imageName)}</path>
    <source>
        <database>Unknown</database>
    </source>
    <size>
        <width>${imageWidth}</width>
        <height>${imageHeight}</height>
        <depth>3</depth> {/* Assuming color images */}
    </size>
    <segmented>0</segmented>\n`; // Segmented is 0 for bounding boxes

    annotations.forEach(annotation => {
        if (annotation.type === 'polygon') {
             hasPolygons = true;
             return; // Skip polygons
        }
        if (annotation.type !== 'rectangle') return; // Skip unknown types

        const className = annotation.class;
        if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
            console.warn(`[Pascal VOC] Skipping invalid rectangle annotation for ${imageName}:`, annotation);
            return;
         }
        const [x, y, width, height] = annotation.rect;
        // VOC expects top-left (xmin, ymin) and bottom-right (xmax, ymax)
        const xmin = Math.max(0, Math.round(x));
        const ymin = Math.max(0, Math.round(y));
        const xmax = Math.min(imageWidth, Math.round(x + width));
        const ymax = Math.min(imageHeight, Math.round(y + height));

         // Skip if dimensions are non-positive after rounding/clamping
         if (xmax <= xmin || ymax <= ymin) {
            console.warn(`[Pascal VOC] Skipping rectangle with non-positive dimensions after rounding/clamping for ${imageName}:`, annotation);
            return;
         }

        xmlContent += `    <object>
        <name>${escapeXml(className)}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated> {/* TODO: Add logic? */}
        <difficult>0</difficult>
        <bndbox>
            <xmin>${xmin}</xmin>
            <ymin>${ymin}</ymin>
            <xmax>${xmax}</xmax>
            <ymax>${ymax}</ymax>
        </bndbox>
    </object>\n`;
        objectCount++;
    });

    xmlContent += `</annotation>`;

    if (hasPolygons) console.warn(`[Pascal VOC Export] Polygons are not supported in Pascal VOC format and were skipped for image ${imageName}.`);

    // Return content only if there were valid rectangle annotations
    return objectCount > 0 ? xmlContent : null;
}

// Generate COCO JSON content for all images (Needs Polygon Segmentation Update)
function generateCOCOJSON(images, allAnnotations, classes) {
    console.warn("[COCO Export] Polygon export currently saves the bounding box, not segmentation masks.");
    const cocoData = {
        info: {
            description: "COCO Dataset generated by LabeLab",
            url: "", version: "1.0", year: new Date().getFullYear(),
            contributor: "LabeLab User", date_created: new Date().toISOString()
        },
        licenses: [{ url: "", id: 1, name: "Default License" }],
        images: [], annotations: [], categories: []
    };

    // Add categories
    classes.forEach((className, index) => {
        cocoData.categories.push({
            supercategory: "none", id: index + 1, name: className // COCO IDs are 1-based
        });
    });

    let annotationId = 1;
    let validAnnotationsFound = false;
    images.forEach((imageObj, imageIndex) => {
        const imageId = imageIndex + 1; // 1-based image ID
        const imageName = imageObj.name;
        const imageWidth = imageObj.width;
        const imageHeight = imageObj.height;

        // Add image info
        cocoData.images.push({
            license: 1, file_name: imageName, coco_url: "", height: imageHeight,
            width: imageWidth, date_captured: "", flickr_url: "", id: imageId
        });

        const annotationsForImage = allAnnotations[imageName] || [];
        annotationsForImage.forEach(annotation => {
            const classIndex = classes.indexOf(annotation.class);
            if (classIndex === -1) {
                 console.warn(`[COCO JSON] Skipping annotation with unknown class '${annotation.class}' for ${imageName}`);
                 return;
            }
            const categoryId = classIndex + 1;

            let bbox = null;
            let area = 0;
            let segmentation = [];

            if (annotation.type === 'rectangle') {
                 if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
                     console.warn(`[COCO JSON] Skipping invalid rectangle annotation for ${imageName}:`, annotation); return;
                 }
                 const [x, y, width, height] = annotation.rect;
                 // COCO bbox is [x, y, width, height]
                 bbox = [x, y, width, height];
                 area = width * height;
                 // For rectangles, segmentation can be the bbox points
                 segmentation = [[x, y, x+width, y, x+width, y+height, x, y+height]];

            } else if (annotation.type === 'polygon') {
                 if (!annotation.points || annotation.points.length < 3) {
                      console.warn(`[COCO JSON] Skipping invalid polygon annotation (less than 3 points) for ${imageName}:`, annotation); return;
                 }
                 // Convert points [{x, y}, ...] to flat array [x1, y1, x2, y2, ...]
                 const flatPoints = annotation.points.reduce((acc, p) => acc.concat(p.x, p.y), []);
                 segmentation = [flatPoints];

                 // Calculate bounding box for the polygon
                 let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                 annotation.points.forEach(p => {
                     minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                     maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                 });
                 const width = maxX - minX;
                 const height = maxY - minY;
                 if (width <= 0 || height <= 0) {
                      console.warn(`[COCO JSON] Skipping polygon with non-positive bounding box dimensions for ${imageName}:`, annotation); return;
                 }
                 bbox = [minX, minY, width, height];
                 // TODO: Calculate actual polygon area? For now, use bbox area.
                 area = width * height;
            } else {
                 console.warn(`[COCO JSON] Skipping annotation of unknown type for ${imageName}:`, annotation); return;
            }

            // Add the annotation entry
            cocoData.annotations.push({
                segmentation: segmentation, // Add segmentation data
                area: area, iscrowd: 0, image_id: imageId,
                bbox: bbox, category_id: categoryId, id: annotationId++
            });
            validAnnotationsFound = true;
        });
    });

    // Return JSON string only if valid annotations were added
    return validAnnotationsFound ? JSON.stringify(cocoData, null, 2) : null;
}

// Generate LabelMe JSON content for a single image (Needs Polygon Update)
function generateLabelMeJSON(imageObj, annotations, classes) {
    console.warn("[LabelMe Export] Polygon export not fully implemented yet. Saving as rectangles based on bounding box.");
    const imageName = imageObj.name;
    const imageWidth = imageObj.width;
    const imageHeight = imageObj.height;
    let shapesAdded = false;

    const labelMeData = {
        version: "5.0.1", // Example version
        flags: {}, shapes: [], imagePath: imageName,
        imageData: null, // Usually imageData is not included in annotation file
        imageHeight: imageHeight, imageWidth: imageWidth
    };

    annotations.forEach(annotation => {
        const className = annotation.class;
        let shape = null;

        if (annotation.type === 'rectangle') {
            if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
                console.warn(`[LabelMe JSON] Skipping invalid rectangle annotation for ${imageName}:`, annotation); return;
            }
            const [x, y, width, height] = annotation.rect;
            const x1 = x; const y1 = y;
            const x2 = x + width; const y2 = y + height;
            if (x2 <= x1 || y2 <= y1) {
                 console.warn(`[LabelMe JSON] Skipping rectangle with non-positive dimensions for ${imageName}:`, annotation); return;
            }
            shape = {
                label: className, points: [ [x1, y1], [x2, y2] ], // Top-left, Bottom-right
                group_id: null, shape_type: "rectangle", flags: {}
            };

        } else if (annotation.type === 'polygon') {
            if (!annotation.points || annotation.points.length < 3) {
                 console.warn(`[LabelMe JSON] Skipping invalid polygon annotation (less than 3 points) for ${imageName}:`, annotation); return;
            }
            // Convert points [{x, y}, ...] to [[x1, y1], [x2, y2], ...]
             const labelMePoints = annotation.points.map(p => [p.x, p.y]);
             shape = {
                 label: className, points: labelMePoints,
                 group_id: null, shape_type: "polygon", flags: {}
             };
             // TODO: The warning says it saves as rectangles, but the code now implements polygon saving.
             // Remove the warning or change the implementation if needed.

        } else {
             console.warn(`[LabelMe JSON] Skipping annotation of unknown type for ${imageName}:`, annotation); return;
        }

        if (shape) {
             labelMeData.shapes.push(shape);
             shapesAdded = true;
        }
    });

    // Return JSON string only if shapes were added
    return shapesAdded ? JSON.stringify(labelMeData, null, 2) : null;
}

// --- Export Dispatcher ---
function handleExport() {
    const selectedFormat = exportFormatSelect.value;

    if (state.images.length === 0) {
        alert("No images to export annotations for."); return;
    }
    if (state.classes.length === 0) {
        alert("Please define classes before exporting."); return;
    }
     if (typeof JSZip === 'undefined') {
         alert("Error: JSZip library not loaded. Cannot export as ZIP.");
         console.error("JSZip library not found. Make sure it's included in your HTML."); return;
     }

    console.log(`Exporting as: ${selectedFormat}`);

    switch(selectedFormat) {
        case 'yolo': exportYOLOZip(); break;
        case 'voc': exportPascalVOCZip(); break;
        case 'coco': exportCOCOZip(); break;
        case 'labelme': exportLabelMeZip(); break;
        case 'all': exportAllFormatsZip(); break;
        default: alert("Invalid export format selected.");
    }
}

// --- Format-Specific ZIP Export Functions --- (Updated from update.js)

async function exportYOLOZip() { // Exports Rectangles Only
    const zip = new JSZip();
    let annotationsGenerated = false;
    console.warn("[YOLO Export] Exporting only rectangle annotations.");

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, ""); // Remove extension
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        let yoloContent = '';
        annotations.forEach(annotation => {
            if (annotation.type !== 'rectangle') return; // Skip non-rectangles

            const classIndex = state.classes.indexOf(annotation.class);
            if (classIndex === -1) {
                console.warn(`[YOLO] Skipping annotation with unknown class '${annotation.class}' for ${imageName}`); return;
            }
            if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) return;

            const [x, y, width, height] = annotation.rect;
            // YOLO format: class_index center_x center_y width height (normalized)
            const centerX = (x + width / 2) / imageObj.width;
            const centerY = (y + height / 2) / imageObj.height;
            const normWidth = width / imageObj.width;
            const normHeight = height / imageObj.height;
            // Clamp values between 0 and 1
            const clamp = (val) => Math.max(0, Math.min(1, val));
            yoloContent += `${classIndex} ${clamp(centerX).toFixed(6)} ${clamp(centerY).toFixed(6)} ${clamp(normWidth).toFixed(6)} ${clamp(normHeight).toFixed(6)}\n`;
        });

        // Add file to zip only if it has content
        if (yoloContent) {
             zip.file(baseName + ".txt", yoloContent);
             annotationsGenerated = true;
        }
    });

    if (!annotationsGenerated) {
        alert("No valid YOLO (rectangle) annotations found to export."); return;
    }

    // Add classes.txt file
    const classesContent = state.classes.join('\n');
    zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "yolo_annotations.zip");
        alert('YOLO (rectangle) annotations successfully exported!');
    } catch (error) {
        console.error("Error generating YOLO ZIP file:", error);
        alert("Failed to generate YOLO ZIP file.");
    }
}

async function exportPascalVOCZip() { // Exports Rectangles Only
    const zip = new JSZip();
    let annotationsGenerated = false;

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        const vocContent = generatePascalVOC(imageObj, annotations, state.classes); // Skips polygons internally
        // Add file only if vocContent is not null (meaning valid rectangles were found)
        if (vocContent) {
             zip.file(baseName + ".xml", vocContent);
             annotationsGenerated = true;
        }
    });

     if (!annotationsGenerated) {
        alert("No valid Pascal VOC (rectangle) annotations found to export."); return;
    }

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "pascal_voc_annotations.zip");
        alert('Pascal VOC (rectangle) annotations successfully exported!');
    } catch (error) {
        console.error("Error generating Pascal VOC ZIP file:", error);
        alert("Failed to generate Pascal VOC ZIP file.");
    }
}

async function exportCOCOZip() { // Exports Polygons + Rectangles (Polygons use BBox for now)
    const zip = new JSZip();
    let annotationsGenerated = false;

    const cocoContent = generateCOCOJSON(state.images, state.annotations, state.classes);
    // Add file only if cocoContent is not null
    if (cocoContent) {
        zip.file("annotations.json", cocoContent);
        annotationsGenerated = true;
    }

    if (!annotationsGenerated) {
        alert("No valid COCO annotations found to export."); return;
    }

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "coco_annotations.zip");
        alert('COCO JSON annotations exported (polygons saved with segmentation)!');
    } catch (error) {
        console.error("Error generating COCO ZIP file:", error);
        alert("Failed to generate COCO ZIP file.");
    }
}

async function exportLabelMeZip() { // Exports Polygons + Rectangles
    const zip = new JSZip();
    let annotationsGenerated = false;

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        const labelmeContent = generateLabelMeJSON(imageObj, annotations, state.classes);
        // Add file only if labelmeContent is not null
        if (labelmeContent) {
             zip.file(baseName + ".json", labelmeContent);
             annotationsGenerated = true;
        }
    });

     if (!annotationsGenerated) {
        alert("No valid LabelMe annotations found to export."); return;
    }

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "labelme_annotations.zip");
        alert('LabelMe JSON annotations successfully exported!');
    } catch (error) {
        console.error("Error generating LabelMe ZIP file:", error);
        alert("Failed to generate LabelMe ZIP file.");
    }
}


async function exportAllFormatsZip() {
    const zip = new JSZip();
    const yoloFolder = zip.folder("yolo");
    const vocFolder = zip.folder("pascal_voc");
    const labelmeFolder = zip.folder("labelme");
    const cocoFolder = zip.folder("coco");
    let annotationsGenerated = { yolo: false, voc: false, labelme: false, coco: false };

    // Generate content for each image for formats that require per-image files
    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        // --- YOLO (Rect only) ---
        let yoloContent = '';
        annotations.forEach(annotation => {
            if (annotation.type !== 'rectangle') return;
            const classIndex = state.classes.indexOf(annotation.class); if (classIndex === -1) return; if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) return;
            const [x, y, width, height] = annotation.rect; const centerX = (x + width / 2) / imageObj.width; const centerY = (y + height / 2) / imageObj.height; const normWidth = width / imageObj.width; const normHeight = height / imageObj.height; const clamp = (val) => Math.max(0, Math.min(1, val));
            yoloContent += `${classIndex} ${clamp(centerX).toFixed(6)} ${clamp(centerY).toFixed(6)} ${clamp(normWidth).toFixed(6)} ${clamp(normHeight).toFixed(6)}\n`;
        });
        if (yoloContent) { yoloFolder.file(baseName + ".txt", yoloContent); annotationsGenerated.yolo = true; }

        // --- Pascal VOC (Rect only) ---
        const vocContent = generatePascalVOC(imageObj, annotations, state.classes);
        if (vocContent) { vocFolder.file(baseName + ".xml", vocContent); annotationsGenerated.voc = true; }

        // --- LabelMe (Rect + Poly) ---
        const labelmeContent = generateLabelMeJSON(imageObj, annotations, state.classes);
        if (labelmeContent) { labelmeFolder.file(baseName + ".json", labelmeContent); annotationsGenerated.labelme = true; }
    });

    // --- COCO (Single File for all images, Rect + Poly) ---
    const cocoContent = generateCOCOJSON(state.images, state.annotations, state.classes);
     if (cocoContent) {
        cocoFolder.file("annotations.json", cocoContent);
        annotationsGenerated.coco = true;
    }

    // Check if any annotations were generated for any format
    const anyGenerated = Object.values(annotationsGenerated).some(Boolean);
    if (!anyGenerated) {
        alert("No valid annotations found to export for any format.");
        return;
    }

    // Add classes.txt (useful for YOLO, maybe others)
    const classesContent = state.classes.join('\n');
    zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "annotations_all_formats.zip");
        alert('All annotation formats successfully exported (check console for warnings about polygon support)!');
    } catch (error) {
        console.error("Error generating combined ZIP file:", error);
        alert("Failed to generate combined ZIP file.");
    }
}

// Helper function to trigger download of a Blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a); // Clean up
    URL.revokeObjectURL(url); // Free up memory
}


// --- Utility Functions --- (Updated Section from update.js)

function updateNavigationButtons() {
    prevImageBtn.disabled = state.currentImageIndex <= 0;
    nextImageBtn.disabled = state.currentImageIndex >= state.images.length - 1 || state.images.length === 0;
    exportSelectedBtn.disabled = state.images.length === 0;
}

function updateUploadCount() {
    uploadCount.textContent = `${state.images.length} image${state.images.length !== 1 ? 's' : ''} loaded`;
    totalImages.textContent = state.images.length;
}

function resetApp() {
    if (state.images.length > 0 || Object.keys(state.annotations).some(key => state.annotations[key].length > 0)) {
        if (!confirm('Are you sure you want to reset? All images and annotations will be lost.')) {
            return;
        }
    }
    state.images = [];
    state.currentImageIndex = -1;
    state.annotations = {};
    state.selectedAnnotationIndex = -1;
    state.isDrawing = false;
    state.isDragging = false;
    state.isSnappingEnabled = false;
    state.snapLines = [];
    cancelCurrentPolygon(); // Ensure polygon state is reset
    selectTool('rectangle'); // Reset tool to rectangle

    resetAppVisuals();
    updateNavigationButtons();
    updateSnapButtonState();
    updateClassList(); // Update class list display (might clear it if default classes were removed)
    updateClassSelect(); // Update class dropdown
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
     annotationsList.innerHTML = ''; // Clear annotation list display
     imageCanvas.style.cursor = 'default';
     imageUpload.value = ''; // Reset file input field
}


function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', init);