// Help System Implementation for LabeLab

// Create Help System Elements
function createHelpSystem() {
  // Create help button
  const helpBtn = document.createElement('button');
  helpBtn.className = 'help-btn'; // Ensure you have CSS for this class
  helpBtn.textContent = ''; // Simple text for the button
  helpBtn.setAttribute('title', 'Show Help (H)');
  // Position the button (example: top right) - adjust as needed in CSS
  helpBtn.style.position = 'fixed';
  helpBtn.style.top = '20px';
  helpBtn.style.right = '20px';
  helpBtn.style.zIndex = '1001'; // Ensure it's above other elements
  document.body.appendChild(helpBtn);

  // Create modal structure
  const helpModal = document.createElement('div');
  helpModal.className = 'help-modal'; // Ensure you have CSS for this class

  const helpContent = document.createElement('div');
  helpContent.className = 'help-content'; // Ensure you have CSS for this class

  // Create header
  const helpHeader = document.createElement('div');
  helpHeader.className = 'help-header'; // Ensure you have CSS for this class

  const helpTitle = document.createElement('h2');
  helpTitle.textContent = 'LabeLab Help';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'help-close'; // Ensure you have CSS for this class
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('title', 'Close Help (Esc)');

  helpHeader.appendChild(helpTitle);
  helpHeader.appendChild(closeBtn);

  // Create tabs
  const helpTabs = document.createElement('div');
  helpTabs.className = 'help-tabs'; // Ensure you have CSS for this class

  const tabs = [
    { id: 'overview', title: 'Overview' },
    { id: 'tools', title: 'Tools' },
    { id: 'annotations', title: 'Annotations' },
    { id: 'classes', title: 'Classes' },
    { id: 'export', title: 'Export' },
    { id: 'shortcuts', title: 'Shortcuts' }
  ];

  tabs.forEach((tab, index) => {
    const tabButton = document.createElement('button');
    tabButton.className = `help-tab ${index === 0 ? 'active' : ''}`; // Ensure CSS handles .help-tab and .active
    tabButton.setAttribute('data-tab', tab.id);
    tabButton.textContent = tab.title;
    helpTabs.appendChild(tabButton);
  });

  // Create content container
  const helpBody = document.createElement('div');
  helpBody.className = 'help-body'; // Ensure you have CSS for this class

  // Content for each tab (Shortcuts updated)
  const tabContents = {
    overview: `
      <div class="help-section">
        <h3>Welcome to LabeLab</h3>
        <p>LabeLab is a web-based image annotation tool designed for machine learning projects. It allows you to easily create bounding boxes and polygons to label objects in images.</p>
        <div class="help-tip">
          <strong>Quick Start:</strong> Upload images, select a tool (rectangle or polygon), define classes, and start labeling!
        </div>
      </div>
      <div class="help-section">
        <h3>Basic Workflow</h3>
        <ol>
          <li>Upload one or more images using the <strong>Upload Images</strong> button</li>
          <li>Add classes that represent the objects you want to label</li>
          <li>Select a tool (Rectangle or Polygon)</li>
          <li>Select a class from the dropdown in the sidebar</li>
          <li>Draw annotations on the image</li>
          <li>Navigate between images using the Previous/Next buttons</li>
          <li>Export your annotations when finished</li>
        </ol>
      </div>
    `,
    tools: `
      <div class="help-section">
        <h3>Rectangle Tool (<span class="help-shortcut">r</span>)</h3>
        <p>Use the rectangle tool to create bounding boxes around objects.</p>
        <ul>
          <li><strong>Draw:</strong> Click and drag to create a bounding box.</li>
          <li><strong>Select/Move:</strong> Click inside an existing box and drag to move it.</li>
          <li><strong>Resize:</strong> (Coming soon!) Functionality to drag corners/edges for resizing.</li>
        </ul>
      </div>
      <div class="help-section">
        <h3>Polygon Tool (<span class="help-shortcut">p</span>)</h3>
        <p>Use the polygon tool to create precise outlines of irregularly shaped objects.</p>
        <ul>
          <li><strong>Draw:</strong> Click to place each point (vertex) of the polygon.</li>
          <li><strong>Complete:</strong> Click near the <strong>starting point</strong> or <strong>double-click</strong> the last point to finish the shape.</li>
          <li><strong>Cancel:</strong> Press <span class="help-shortcut">Esc</span> while drawing to cancel the current polygon.</li>
          <li><strong>Select/Move:</strong> (Coming soon!) Functionality to select and move polygons.</li>
          <li><strong>Edit Points:</strong> (Coming soon!) Functionality to drag existing points.</li>
        </ul>
      </div>
      <div class="help-section">
        <h3>Snap Feature (<span class="help-shortcut">s</span>)</h3>
        <p>The Snap feature helps with precise point placement by snapping to nearby annotation edges or image boundaries.</p>
        <ul>
          <li>Toggle Snap on/off using the <strong>🧲 Snap</strong> button or the <span class="help-shortcut">s</span> key.</li>
          <li>When active, points will snap to relevant lines while drawing or dragging.</li>
          <li>Temporary red lines indicate potential snap targets.</li>
        </ul>
      </div>
    `,
    annotations: `
      <div class="help-section">
        <h3>Managing Annotations</h3>
        <p>The sidebar displays a list of all annotations for the current image.</p>
        <ul>
          <li><strong>Select:</strong> Click on an annotation in the list or directly on the canvas (rectangles only for now) to select it.</li>
          <li><strong>Change Class:</strong> Use the dropdown next to each annotation in the list to change its class.</li>
          <li><strong>Delete:</strong> Select an annotation and click the <strong>Delete Selected Annotation</strong> button or press <span class="help-shortcut">Delete</span>/<span class="help-shortcut">Backspace</span>.</li>
          <li><strong>Deselect:</strong> Press <span class="help-shortcut">Esc</span> to deselect the current annotation.</li>
        </ul>
      </div>
      <div class="help-section">
        <h3>Annotation Colors</h3>
        <p>Each class is assigned a unique color, visible in the class list and on the annotations themselves.</p>
      </div>
    `,
    classes: `
      <div class="help-section">
        <h3>Adding Classes</h3>
        <p>Define the categories (classes) of objects you want to label before annotating.</p>
        <ol>
          <li>Enter a class name in the "Add new class..." input field.</li>
          <li>Click the "Add Class" button or press <span class="help-shortcut">Enter</span>.</li>
          <li>The class appears in the list below with an assigned color.</li>
        </ol>
      </div>
      <div class="help-section">
        <h3>Selecting Classes</h3>
        <p>Before creating an annotation, select the desired class either from the list below the input field or from the "Select Class" dropdown in the sidebar. New annotations will use this selected class.</p>
      </div>
      <div class="help-section">
        <h3>Removing Classes</h3>
        <p>Click the "×" button next to a class name in the list to remove it.</p>
        <div class="help-tip">
          <strong>Warning:</strong> Deleting a class will permanently remove all associated annotations across all images!
        </div>
      </div>
    `,
    export: `
      <div class="help-section">
        <h3>Export Formats</h3>
        <p>LabeLab supports multiple export formats:</p>
        <ul>
          <li><strong>YOLO (txt):</strong> Suitable for YOLO models. Exports rectangles only.</li>
          <li><strong>Pascal VOC (xml):</strong> Common object detection format. Exports rectangles only.</li>
          <li><strong>COCO (json):</strong> Widely used format, supports rectangles and polygons (segmentation).</li>
          <li><strong>LabelMe (json):</strong> Format used by LabelMe, supports rectangles and polygons.</li>
          <li><strong>All Formats:</strong> Exports all supported types in separate folders within a single ZIP.</li>
        </ul>
      </div>
      <div class="help-section">
        <h3>Export Process</h3>
        <ol>
          <li>Select the desired format from the "Export Format" dropdown.</li>
          <li>Click the "Export" button.</li>
          <li>A ZIP file containing the annotations will be downloaded.</li>
        </ol>
      </div>
    `,
    shortcuts: `
      <div class="help-section">
        <h3>Keyboard Shortcuts</h3>
        <p>Use these shortcuts to speed up your workflow:</p>
        <table class="help-shortcuts-table">
          <thead>
            <tr><th>Action</th><th>Shortcut</th></tr>
          </thead>
          <tbody>
            <tr><td>Delete selected annotation</td><td><span class="help-shortcut">Delete</span> or <span class="help-shortcut">Backspace</span></td></tr>
            <tr><td>Next image</td><td><span class="help-shortcut">→</span> (Right Arrow)</td></tr>
            <tr><td>Previous image</td><td><span class="help-shortcut">←</span> (Left Arrow)</td></tr>
            <tr><td>Select Rectangle Tool</td><td><span class="help-shortcut">r</span></td></tr>
            <tr><td>Select Polygon Tool</td><td><span class="help-shortcut">p</span></td></tr>
            <tr><td>Toggle Snap</td><td><span class="help-shortcut">s</span></td></tr>
            <tr><td>Cancel drawing / Deselect</td><td><span class="help-shortcut">Esc</span></td></tr>
            <tr><td>Open/Close Help</td><td><span class="help-shortcut">h</span> / <span class="help-shortcut">Esc</span></td></tr>
          </tbody>
        </table>
        <div class="help-tip">
          <strong>Note:</strong> Shortcuts do not work when the text input fields have focus.
        </div>
      </div>
    `
  };

  // Create tab contents
  Object.keys(tabContents).forEach((tabId, index) => {
    const tabContent = document.createElement('div');
    // Add CSS class for styling tab content
    tabContent.className = `help-tab-content ${index === 0 ? 'active' : ''}`;
    tabContent.setAttribute('data-tab-content', tabId);
    tabContent.innerHTML = tabContents[tabId];
    helpBody.appendChild(tabContent);
  });

  // Create footer
  const helpFooter = document.createElement('div');
  helpFooter.className = 'help-footer'; // Ensure you have CSS for this class
  helpFooter.innerHTML = `LabeLab by <a href="https://il.linkedin.com/in/yehuda-heller" target="_blank" rel="noopener noreferrer">Yehuda Heller</a>`;

  // Assemble modal
  helpContent.appendChild(helpHeader);
  helpContent.appendChild(helpTabs);
  helpContent.appendChild(helpBody);
  helpContent.appendChild(helpFooter);
  helpModal.appendChild(helpContent);
  document.body.appendChild(helpModal);

  // --- Event Handlers ---

  // Open help modal
  helpBtn.addEventListener('click', () => {
    helpModal.classList.add('active'); // Add 'active' class to show modal
  });

  // Close help modal
  const closeHelp = () => {
    helpModal.classList.remove('active'); // Remove 'active' class to hide modal
  };

  closeBtn.addEventListener('click', closeHelp);

  // Close when clicking outside the modal content
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      closeHelp();
    }
  });

  // Tab switching logic
  helpTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('help-tab')) {
      const previouslyActiveTab = helpTabs.querySelector('.help-tab.active');
      const previouslyActiveContent = helpBody.querySelector('.help-tab-content.active');

      if (previouslyActiveTab) previouslyActiveTab.classList.remove('active');
      if (previouslyActiveContent) previouslyActiveContent.classList.remove('active');

      e.target.classList.add('active');
      const tabId = e.target.getAttribute('data-tab');
      const newActiveContent = helpBody.querySelector(`.help-tab-content[data-tab-content="${tabId}"]`);
      if (newActiveContent) newActiveContent.classList.add('active');
    }
  });

  // Keyboard shortcuts for help window itself
  document.addEventListener('keydown', (e) => {
    // Use 'h' (lowercase) for consistency with other shortcuts
    if (e.key === 'h') {
      // Check if focus is on an input/select/textarea to avoid conflict
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');
      if (!isInputFocused) {
        e.preventDefault(); // Prevent typing 'h' if not intended
        helpModal.classList.toggle('active'); // Toggle display
      }
    }

    // Use 'Escape' to close the modal if it's open
    if (e.key === 'Escape' && helpModal.classList.contains('active')) {
      // No need to preventDefault here usually, as Escape might have other functions (like deselecting) handled elsewhere
      closeHelp();
    }
  });

  // Add context-sensitive help indicators (Tooltips) - Optional enhancement
  // addContextHelp(); // You can uncomment this if you add CSS for .tooltip and .tooltip-text
}

// Function to add tooltips (requires CSS for .tooltip and .tooltip-text)
// function addContextHelp() {
//   const tooltips = [
//     { selector: '#select-tool-rect', text: 'Rectangle Tool (r): Draw bounding boxes.' },
//     { selector: '#select-tool-poly', text: 'Polygon Tool (p): Draw precise shapes.' },
//     // ... add more tooltips for other elements ...
//   ];
//   tooltips.forEach(tip => {
//     const element = document.querySelector(tip.selector);
//     if (element) {
//       element.classList.add('tooltip'); // Add a class for positioning context
//       const tooltipText = document.createElement('span');
//       tooltipText.className = 'tooltip-text'; // Class for tooltip styling
//       tooltipText.textContent = tip.text;
//       element.appendChild(tooltipText);
//     }
//   });
// }

// Initialize help system when DOM is fully loaded
document.addEventListener('DOMContentLoaded', createHelpSystem);