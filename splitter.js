const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');

const markers = [];
lines.forEach((line, index) => {
    if (line.startsWith('// --- ')) {
        markers.push({ name: line.replace('// --- ', '').replace(' ---', '').trim(), lineIndex: index });
    }
});

console.log("Markers found:", markers);

const getFileName = (name) => {
    name = name.toLowerCase();
    if (name.includes('rent calculation')) return 'rent-engine.js';
    if (name.includes('view rendering')) return 'view-routing.js';
    if (name.includes('content rendering')) return 'render.js';
    if (name.includes('global actions')) return 'actions.js';
    if (name.includes('email receipt')) return 'receipts.js';
    if (name.includes('form & modal')) return 'modals.js';
    if (name.includes('initialization')) return 'events.js';
    return 'unknown.js';
};

if (!fs.existsSync('js')) fs.mkdirSync('js');

// Part 1: Top of file to first marker
const configLines = lines.slice(0, markers.length > 0 ? markers[0].lineIndex : lines.length);
fs.writeFileSync('js/state.js', configLines.join('\n'));

// Other Parts
for (let i = 0; i < markers.length; i++) {
    const start = markers[i].lineIndex;
    const end = (i + 1 < markers.length) ? markers[i+1].lineIndex : lines.length;
    
    // Some markers might be exact duplicates consecutively, let's merge them
    if (end - start <= 2 && (i+1 < markers.length) && markers[i+1].name === markers[i].name) {
        continue; // handled next
    }
    
    // Find output file name
    let fn = getFileName(markers[i].name);
    // If output file already exists, append
    let sectionContent = lines.slice(start, end).join('\n');
    
    if (fs.existsSync('js/' + fn)) {
        fs.appendFileSync('js/' + fn, '\n' + sectionContent);
    } else {
        fs.writeFileSync('js/' + fn, sectionContent);
    }
}
console.log('Splitting completed successfully.');
