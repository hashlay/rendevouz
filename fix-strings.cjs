const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // AnnouncedResultsView.tsx
  content = content.replace(
    /Campus Festival events\./g,
    "{eventSettings?.campusName || 'Campus'} {eventSettings?.festivalName || 'Festival'} events."
  );

  // ChestNumbersView.tsx
  content = content.replace(
    /Sahityotsav — Chest Number List/g,
    "{eventSettings?.festivalName || 'Festival'} — Chest Number List"
  );
  
  content = content.replace(
    /Campus \| Generated:/g,
    "{eventSettings?.campusName || 'Campus'} | Generated:"
  );

  // PosterGeneratorView.tsx
  content = content.replace(
    /Royal Festival \(Dark Navy\)/g,
    "{festivalName} (Dark Navy)"
  );

  // RegisteredEventsView.tsx
  content = content.replace(
    /FESTIVAL - REGISTERED ENTRIES/g,
    "{eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} - REGISTERED ENTRIES"
  );

  // ReportsView.tsx
  content = content.replace(
    />FESTIVAL 2026</g,
    ">{eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} 2026<"
  );
  content = content.replace(
    />CAMPUS COMMITTEE</g,
    ">{eventSettings?.campusName?.toUpperCase() || 'CAMPUS'} COMMITTEE<"
  );
  content = content.replace(
    />CAMPUS FESTIVAL CHAIRMAN</g,
    ">{eventSettings?.campusName?.toUpperCase() || 'CAMPUS'} {eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} CHAIRMAN<"
  );

  // Sidebar.tsx and others where I might have hardcoded it:
  // Actually, I don't think I hardcoded FESTIVAL anywhere else improperly, but let me check.

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
