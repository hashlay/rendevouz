const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Remove SUNNI STUDENTS FEDERATION (SSF) completely
  content = content.replace(/<h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">SUNNI STUDENTS FEDERATION \(SSF\)<\/h1>\n?/g, '');
  
  // 2. Fix UNIT to use entityLabel
  // But note that entityLabel is `const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';`
  // Some files might not have `entityLabel` defined. 
  // Let's replace `UNIT:` or `Unit:` with the dynamic check or `entityLabel`.

  // In RegisteredEventsView.tsx:
  // <span>UNIT: <strong ...
  // -> <span>{entityLabel.toUpperCase()}: <strong ...
  content = content.replace(/<span>UNIT: /g, '<span>{entityLabel.toUpperCase()}: ');
  content = content.replace(/: 'ALL UNITS'}/g, ": `ALL ${entityLabel.toUpperCase()}S`}");

  // In AnnouncedResultsView.tsx:
  // Unit: <strong...
  content = content.replace(/Unit: <strong/g, '{entityLabel}: <strong');

  // In CertificatesView.tsx:
  // Unit: {winnerUnitName}
  content = content.replace(/Unit: \{winnerUnitName\}/g, '{entityLabel}: {winnerUnitName}');

  // In ParticipantsView.tsx:
  // Unit: <span className="font-semibold
  content = content.replace(/Unit: <span className="font-semibold/g, '{entityLabel}: <span className="font-semibold');

  // In ResultEntryView.tsx:
  // Representing Unit: {unit
  content = content.replace(/Representing Unit: \{unit/g, 'Representing {entityLabel}: {unit');

  // In ScoreboardView.tsx:
  // Unit: <span className="font-semibold
  content = content.replace(/Unit: <span className="font-semibold/g, '{entityLabel}: <span className="font-semibold');

  // In UsersView.tsx:
  // <>Unit: <strong...
  content = content.replace(/<>Unit: <strong/g, '<>{entityLabel}: <strong');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
