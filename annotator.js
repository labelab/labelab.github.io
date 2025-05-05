// DOM Elements
const imageUpload = document.getElementById('image-upload');
const uploadCount = document.getElementById('upload-count');
const classInput = document.getElementById('class-input');
const addClassBtn = document.getElementById('add-class-btn');
const classList = document.getElementById('class-list');
const prevImageBtn = document.getElementById('prev-image-btn');
const nextImageBtn = document.getElementById('next-image-btn');
// const exportBtn = document.getElementById('export-btn'); // Old button removed reference
const resetBtn = document.getElementById('reset-btn');
const imageCanvas = document.getElementById('image-canvas');
const noImageMessage = document.getElementById('no-image-message');
const imageName = document.getElementById('image-name');
const imageIndex = document.getElementById('image-index');
const totalImages = document.getElementById('total-images');
const currentClassSelect = document.getElementById('current-class');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const annotationsList = document.getElementById('annotations-list');
const exportFormatSelect = document.getElementById('export-format-select'); // New select element
const exportSelectedBtn = document.getElementById('export-selected-btn'); // New export button

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
    // exportBtn.addEventListener('click', exportAllFormatsZip); // Old listener removed
    exportSelectedBtn.addEventListener('click', handleExport); // New listener for the specific export button
    resetBtn.addEventListener('click', resetApp);
    deleteSelectedBtn.addEventListener('click', deleteSelectedAnnotation);
    currentClassSelect.addEventListener('change', (e) => {
        state.currentClass = e.target.value;
    });

    // Canvas event listeners
    imageCanvas.addEventListener('mousedown', handleMouseDown);
    imageCanvas.addEventListener('mousemove', handleMouseMove);
    imageCanvas.addEventListener('mouseup', handleMouseUp);
    imageCanvas.addEventListener('mouseleave', handleMouseLeave);

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

    // Scaling and centering logic
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
            e.stopPropagation();
            removeClass(e.target.getAttribute('data-class'));
        });
         li.addEventListener('click', () => {
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

    const fillAlpha = isSelected ? 0.25 : 0.1;
    const fillColor = `${color}${Math.floor(fillAlpha * 255).toString(16).padStart(2, '0')}`;

    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);

    drawRoundedRect(x, y, width, height, strokeColor, strokeWidth);

    const text = className;
    ctx.font = 'bold 12px Arial';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = 18;
    const padding = 6;
    const labelX = x;
    const labelY = y > textHeight + padding ? y - textHeight - padding : y + height + padding;

    ctx.fillStyle = color;
    drawRoundedRect(labelX, labelY, textWidth + padding * 2, textHeight, color, 0, true);

    ctx.fillStyle = '#fff';
    ctx.fillText(text, labelX + padding, labelY + textHeight - padding/2);

    if (isSelected) {
        drawSelectionHandles(x, y, width, height);
    }
}

function drawRoundedRect(x, y, width, height, color, lineWidth = 2, fill = false) {
    const radius = 3;
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

function drawSelectionHandles(x, y, width, height) {
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    const handleColor = "#ffffff";
    const borderColor = "#000000";

    const corners = [
        {x: x, y: y},
        {x: x + width, y: y},
        {x: x + width, y: y + height},
        {x: x, y: y + height}
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

// --- Mouse Event Handlers ---

function handleMouseDown(e) {
    if (state.currentImageIndex === -1) return;

    const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
    const currentImageName = state.images[state.currentImageIndex].name;
    const annotations = state.annotations[currentImageName] || [];

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
        state.selectedAnnotationIndex = clickedAnnotationIndex;
        state.isDragging = true;
        state.isDrawing = false;
        const selectedRect = annotations[clickedAnnotationIndex].rect;
        state.dragOffsetX = mouseX - (selectedRect[0] * state.canvasScale);
        state.dragOffsetY = mouseY - (selectedRect[1] * state.canvasScale);
        deleteSelectedBtn.disabled = false;
        imageCanvas.style.cursor = 'move';
    } else {
        if (!state.currentClass) {
             alert("Please select a class before drawing.");
             return;
        }
        state.isDrawing = true;
        state.isDragging = false;
        state.startX = mouseX;
        state.startY = mouseY;
        state.selectedAnnotationIndex = -1;
        deleteSelectedBtn.disabled = true;
        imageCanvas.style.cursor = 'crosshair';
    }

    redrawCanvas();
    updateAnnotationsList();
}

function handleMouseMove(e) {
    const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);

    if (state.isDragging && state.selectedAnnotationIndex !== -1) {
        const currentImageName = state.images[state.currentImageIndex].name;
        const annotation = state.annotations[currentImageName][state.selectedAnnotationIndex];
        let newX = (mouseX - state.dragOffsetX) / state.canvasScale;
        let newY = (mouseY - state.dragOffsetY) / state.canvasScale;

        newX = Math.max(0, Math.min(newX, state.imageSize.width - annotation.rect[2]));
        newY = Math.max(0, Math.min(newY, state.imageSize.height - annotation.rect[3]));

        annotation.rect[0] = newX;
        annotation.rect[1] = newY;
        redrawCanvas();
    } else if (state.isDrawing) {
        redrawCanvas();
        const width = mouseX - state.startX;
        const height = mouseY - state.startY;
        ctx.strokeStyle = getClassColor(state.currentClass) || '#0000ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(state.startX, state.startY, width, height);
    } else {
         updateCursorStyle(mouseX, mouseY);
    }
}

function handleMouseUp(e) {
    if (state.isDrawing) {
        const { x: mouseX, y: mouseY } = getMousePos(imageCanvas, e);
        const width = mouseX - state.startX;
        const height = mouseY - state.startY;

        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
            const currentImageName = state.images[state.currentImageIndex].name;
            const x = Math.min(state.startX, mouseX) / state.canvasScale;
            const y = Math.min(state.startY, mouseY) / state.canvasScale;
            const w = Math.abs(width) / state.canvasScale;
            const h = Math.abs(height) / state.canvasScale;

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

    state.isDrawing = false;
    state.isDragging = false;
    imageCanvas.style.cursor = 'default';
    redrawCanvas();
    updateAnnotationsList();
}

function handleMouseLeave(e) {
    if (state.isDrawing || state.isDragging) {
        handleMouseUp(e);
    }
     imageCanvas.style.cursor = 'default';
}


function updateCursorStyle(mouseX, mouseY) {
     if (state.currentImageIndex === -1 || state.isDragging || state.isDrawing) return;

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
         imageCanvas.style.cursor = 'move';
     } else {
         imageCanvas.style.cursor = state.currentClass ? 'crosshair' : 'default';
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

        li.addEventListener('click', (e) => {
             if (e.target.tagName !== 'SELECT') {
                 state.selectedAnnotationIndex = index;
                 deleteSelectedBtn.disabled = false;
                 redrawCanvas();
                 updateAnnotationsList();
             }
        });

        const selector = li.querySelector('.annotation-class-selector');
        selector.addEventListener('change', (e) => {
             const newClass = e.target.value;
             const annotationIndex = parseInt(e.target.getAttribute('data-index'));
             state.annotations[currentImage.name][annotationIndex].class = newClass;
             state.selectedAnnotationIndex = annotationIndex;
             redrawCanvas();
             updateAnnotationsList();
        });
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
    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            showPreviousImage();
            break;
        case 'ArrowRight':
            e.preventDefault();
            showNextImage();
            break;
        case 'Delete':
        case 'Backspace':
             if (state.selectedAnnotationIndex !== -1 && !deleteSelectedBtn.disabled) {
                 e.preventDefault();
                 deleteSelectedAnnotation();
             }
            break;
    }
}


// --- Export ---

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


// Generate Pascal VOC XML content for a single image
function generatePascalVOC(imageObj, annotations, classes) {
    const imageName = imageObj.name;
    const imageWidth = imageObj.width;
    const imageHeight = imageObj.height;

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
        <depth>3</depth>
    </size>
    <segmented>0</segmented>\n`;

    annotations.forEach(annotation => {
        const className = annotation.class;
        if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
            console.warn(`[Pascal VOC] Skipping invalid annotation for ${imageName}:`, annotation);
            return;
         }
        const [x, y, width, height] = annotation.rect;
        const xmin = Math.max(0, Math.round(x));
        const ymin = Math.max(0, Math.round(y));
        const xmax = Math.min(imageWidth, Math.round(x + width));
        const ymax = Math.min(imageHeight, Math.round(y + height));

         if (xmax <= xmin || ymax <= ymin) {
            console.warn(`[Pascal VOC] Skipping annotation with non-positive dimensions after rounding/clamping for ${imageName}:`, annotation);
            return;
         }

        xmlContent += `    <object>
        <name>${escapeXml(className)}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>${xmin}</xmin>
            <ymin>${ymin}</ymin>
            <xmax>${xmax}</xmax>
            <ymax>${ymax}</ymax>
        </bndbox>
    </object>\n`;
    });

    xmlContent += `</annotation>`;
    return xmlContent;
}

// Generate COCO JSON content for all images
function generateCOCOJSON(images, allAnnotations, classes) {
    const cocoData = {
        info: {
            description: "COCO Dataset generated by LabeLab",
            url: "",
            version: "1.0",
            year: new Date().getFullYear(),
            contributor: "LabeLab User",
            date_created: new Date().toISOString()
        },
        licenses: [{ url: "", id: 1, name: "Default License" }],
        images: [],
        annotations: [],
        categories: []
    };

    classes.forEach((className, index) => {
        cocoData.categories.push({
            supercategory: "none",
            id: index + 1,
            name: className
        });
    });

    let annotationId = 1;
    images.forEach((imageObj, imageIndex) => {
        const imageId = imageIndex + 1;
        const imageName = imageObj.name;
        const imageWidth = imageObj.width;
        const imageHeight = imageObj.height;

        cocoData.images.push({
            license: 1,
            file_name: imageName,
            coco_url: "",
            height: imageHeight,
            width: imageWidth,
            date_captured: "",
            flickr_url: "",
            id: imageId
        });

        const annotationsForImage = allAnnotations[imageName] || [];
        annotationsForImage.forEach(annotation => {
            const classIndex = classes.indexOf(annotation.class);
            if (classIndex === -1) return;

            if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
                console.warn(`[COCO JSON] Skipping invalid annotation for ${imageName}:`, annotation);
                return;
             }

            const [x, y, width, height] = annotation.rect;
            const categoryId = classIndex + 1;

             if (width <= 0 || height <= 0) {
                 console.warn(`[COCO JSON] Skipping annotation with non-positive dimensions for ${imageName}:`, annotation);
                 return;
             }

            cocoData.annotations.push({
                segmentation: [],
                area: width * height,
                iscrowd: 0,
                image_id: imageId,
                bbox: [x, y, width, height],
                category_id: categoryId,
                id: annotationId++
            });
        });
    });

    return JSON.stringify(cocoData, null, 2);
}

// Generate LabelMe JSON content for a single image
function generateLabelMeJSON(imageObj, annotations, classes) {
    const imageName = imageObj.name;
    const imageWidth = imageObj.width;
    const imageHeight = imageObj.height;

    const labelMeData = {
        version: "5.0.1",
        flags: {},
        shapes: [],
        imagePath: imageName,
        imageData: null,
        imageHeight: imageHeight,
        imageWidth: imageWidth
    };

    annotations.forEach(annotation => {
        const className = annotation.class;
        if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) {
            console.warn(`[LabelMe JSON] Skipping invalid annotation for ${imageName}:`, annotation);
            return;
         }

        const [x, y, width, height] = annotation.rect;
        const x1 = x;
        const y1 = y;
        const x2 = x + width;
        const y2 = y + height;

         if (x2 <= x1 || y2 <= y1) {
            console.warn(`[LabelMe JSON] Skipping annotation with non-positive dimensions for ${imageName}:`, annotation);
            return;
         }

        labelMeData.shapes.push({
            label: className,
            points: [ [x1, y1], [x2, y2] ],
            group_id: null,
            shape_type: "rectangle",
            flags: {}
        });
    });

    return JSON.stringify(labelMeData, null, 2);
}

// --- NEW: Export Dispatcher ---
function handleExport() {
    const selectedFormat = exportFormatSelect.value;

    if (state.images.length === 0) {
        alert("No images to export annotations for.");
        return;
    }
    if (state.classes.length === 0) {
        alert("Please define classes before exporting.");
        return;
    }
     if (typeof JSZip === 'undefined') {
         alert("Error: JSZip library not loaded. Cannot export as ZIP.");
         console.error("JSZip library not found. Make sure it's included in your HTML.");
         return;
     }

    switch(selectedFormat) {
        case 'yolo':
            exportYOLOZip();
            break;
        case 'voc':
            exportPascalVOCZip();
            break;
        case 'coco':
            exportCOCOZip();
            break;
        case 'labelme':
            exportLabelMeZip();
            break;
        case 'all':
            exportAllFormatsZip();
            break;
        default:
            alert("Invalid export format selected.");
    }
}

// --- NEW: Format-Specific ZIP Export Functions ---

async function exportYOLOZip() {
    const zip = new JSZip();
    let annotationsGenerated = false;

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        let yoloContent = '';
        annotations.forEach(annotation => {
            const classIndex = state.classes.indexOf(annotation.class);
            if (classIndex === -1) return;
            if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) return;

            const [x, y, width, height] = annotation.rect;
            const centerX = (x + width / 2) / imageObj.width;
            const centerY = (y + height / 2) / imageObj.height;
            const normWidth = width / imageObj.width;
            const normHeight = height / imageObj.height;
            const clamp = (val) => Math.max(0, Math.min(1, val));
            yoloContent += `${classIndex} ${clamp(centerX).toFixed(6)} ${clamp(centerY).toFixed(6)} ${clamp(normWidth).toFixed(6)} ${clamp(normHeight).toFixed(6)}\n`;
        });

        if (yoloContent) {
             zip.file(baseName + ".txt", yoloContent);
             annotationsGenerated = true;
        }
    });

    if (!annotationsGenerated) {
        alert("No valid YOLO annotations found to export.");
        return;
    }

    const classesContent = state.classes.join('\n');
    zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "yolo_annotations.zip");
        alert('YOLO annotations successfully exported!');
    } catch (error) {
        console.error("Error generating YOLO ZIP file:", error);
        alert("Failed to generate YOLO ZIP file.");
    }
}

async function exportPascalVOCZip() {
    const zip = new JSZip();
    let annotationsGenerated = false;

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        const vocContent = generatePascalVOC(imageObj, annotations, state.classes);
        if (vocContent.includes('<object>')) {
             zip.file(baseName + ".xml", vocContent);
             annotationsGenerated = true;
        }
    });

     if (!annotationsGenerated) {
        alert("No valid Pascal VOC annotations found to export.");
        return;
    }

    // Optionally include classes.txt for reference
    // const classesContent = state.classes.join('\n');
    // zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "pascal_voc_annotations.zip");
        alert('Pascal VOC annotations successfully exported!');
    } catch (error) {
        console.error("Error generating Pascal VOC ZIP file:", error);
        alert("Failed to generate Pascal VOC ZIP file.");
    }
}

async function exportCOCOZip() {
    const zip = new JSZip();
    let annotationsGenerated = false;

    const cocoContent = generateCOCOJSON(state.images, state.annotations, state.classes);
    if (cocoContent && JSON.parse(cocoContent).annotations.length > 0) {
        zip.file("annotations.json", cocoContent);
        annotationsGenerated = true;
    }

    if (!annotationsGenerated) {
        alert("No valid COCO annotations found to export.");
        return;
    }

     // Optionally include classes.txt for reference
     const classesContent = state.classes.join('\n');
     zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "coco_annotations.zip");
        alert('COCO JSON annotations successfully exported!');
    } catch (error) {
        console.error("Error generating COCO ZIP file:", error);
        alert("Failed to generate COCO ZIP file.");
    }
}

async function exportLabelMeZip() {
    const zip = new JSZip();
    let annotationsGenerated = false;

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        const labelmeContent = generateLabelMeJSON(imageObj, annotations, state.classes);
        if (labelmeContent && JSON.parse(labelmeContent).shapes.length > 0) {
             zip.file(baseName + ".json", labelmeContent);
             annotationsGenerated = true;
        }
    });

     if (!annotationsGenerated) {
        alert("No valid LabelMe annotations found to export.");
        return;
    }

    // Optionally include classes.txt for reference
    // const classesContent = state.classes.join('\n');
    // zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "labelme_annotations.zip");
        alert('LabelMe JSON annotations successfully exported!');
    } catch (error) {
        console.error("Error generating LabelMe ZIP file:", error);
        alert("Failed to generate LabelMe ZIP file.");
    }
}


// --- Combined Export (Remains the same logic as before, just called explicitly) ---
async function exportAllFormatsZip() {
    const zip = new JSZip();
    const yoloFolder = zip.folder("yolo");
    const vocFolder = zip.folder("pascal_voc");
    const labelmeFolder = zip.folder("labelme");
    const cocoFolder = zip.folder("coco"); // Added COCO folder
    let annotationsGenerated = false;

    state.images.forEach(imageObj => {
        const imageName = imageObj.name;
        const baseName = imageName.replace(/\.[^/.]+$/, "");
        const annotations = state.annotations[imageName];
        if (!annotations || annotations.length === 0) return;

        // YOLO
        let yoloContent = '';
        annotations.forEach(annotation => {
            const classIndex = state.classes.indexOf(annotation.class);
            if (classIndex === -1) return;
            if (!annotation.rect || annotation.rect.length < 4 || annotation.rect[2] <= 0 || annotation.rect[3] <= 0) return;
            const [x, y, width, height] = annotation.rect;
            const centerX = (x + width / 2) / imageObj.width;
            const centerY = (y + height / 2) / imageObj.height;
            const normWidth = width / imageObj.width;
            const normHeight = height / imageObj.height;
            const clamp = (val) => Math.max(0, Math.min(1, val));
            yoloContent += `${classIndex} ${clamp(centerX).toFixed(6)} ${clamp(centerY).toFixed(6)} ${clamp(normWidth).toFixed(6)} ${clamp(normHeight).toFixed(6)}\n`;
        });
        if (yoloContent) {
            yoloFolder.file(baseName + ".txt", yoloContent);
            annotationsGenerated = true;
        }

        // Pascal VOC
        const vocContent = generatePascalVOC(imageObj, annotations, state.classes);
        if (vocContent.includes('<object>')) {
             vocFolder.file(baseName + ".xml", vocContent);
             annotationsGenerated = true;
        }

        // LabelMe
        const labelmeContent = generateLabelMeJSON(imageObj, annotations, state.classes);
        if (labelmeContent && JSON.parse(labelmeContent).shapes.length > 0) {
             labelmeFolder.file(baseName + ".json", labelmeContent);
             annotationsGenerated = true;
        }
    });

    // COCO (Single File)
    const cocoContent = generateCOCOJSON(state.images, state.annotations, state.classes);
     if (cocoContent && JSON.parse(cocoContent).annotations.length > 0) {
        cocoFolder.file("annotations.json", cocoContent); // Place in its own folder
        annotationsGenerated = true;
    }

    if (!annotationsGenerated) {
        alert("No valid annotations found to export for any format.");
        return;
    }

    const classesContent = state.classes.join('\n');
    zip.file("classes.txt", classesContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "annotations_all_formats.zip");
        alert('All annotation formats successfully exported!');
    } catch (error) {
        console.error("Error generating combined ZIP file:", error);
        alert("Failed to generate combined ZIP file.");
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
    URL.revokeObjectURL(url);
}

// --- Utility Functions ---

function updateNavigationButtons() {
    prevImageBtn.disabled = state.currentImageIndex <= 0;
    nextImageBtn.disabled = state.currentImageIndex >= state.images.length - 1 || state.images.length === 0;
    // Update the new export button's state
    exportSelectedBtn.disabled = state.images.length === 0; // Enable export if images are loaded
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
    state.images = [];
    state.currentImageIndex = -1;
    // state.classes = []; // Keep classes
    state.annotations = {};
    state.selectedAnnotationIndex = -1;
    state.isDrawing = false;
    state.isDragging = false;

    resetAppVisuals();
    updateNavigationButtons();
    // updateClassList();
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

// --- Start the application ---
document.addEventListener('DOMContentLoaded', init);