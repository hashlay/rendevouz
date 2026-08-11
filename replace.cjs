const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Logos
  // Replace both logos with the uploaded one
  // eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'
  content = content.replace(/"\/logos\/ssf-logo\.png"/g, "{eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'}");
  content = content.replace(/"\/logos\/sahityotsav-logo\.png"/g, "{eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'}");
  
  // Also handle cases where it's already in brackets but using quotes
  // wait, the above replaces the string inside quotes, but inside JSX it might be src="/logos..."
  // src="/logos/ssf-logo.png" -> src={eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'}
  content = content.replace(/src="\/logos\/ssf-logo\.png"/g, "src={eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'}");
  content = content.replace(/src="\/logos\/sahityotsav-logo\.png"/g, "src={eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'}");
  
  // 2. Texts
  content = content.replace(/Ninthikal Sahityotsav/gi, "Campus Festival");
  content = content.replace(/Sahityotsav - Chest Number List/gi, "Festival - Chest Number List");
  content = content.replace(/Ninthikal Campus/gi, "Campus");
  content = content.replace(/NINTHIKAL SECTOR COMITE/g, "CAMPUS COMMITTEE");
  content = content.replace(/SECTOR SAHITYOTSAV CHAIRMAN/g, "CAMPUS FESTIVAL CHAIRMAN");
  content = content.replace(/SSF SAHITYOTSAV 2026/g, "FESTIVAL 2026");
  content = content.replace(/Kerala Royal Sahityotsav/gi, "Royal Festival");
  content = content.replace(/KARNATAKA SAHITYOTSAV/gi, "FESTIVAL");
  
  // Replace standalone Sahityotsav in JSX text where eventSettings is available
  // E.g., >Sahityotsav<
  content = content.replace(/>Sahityotsav</g, ">{eventSettings?.festivalName || 'Festival'}<");
  
  // Hardcoded replacements
  content = content.replace(/Ninthikal Sector/g, "Campus");
  content = content.replace(/NINTHIKAL SECTOR/g, "CAMPUS");
  content = content.replace(/Shafi Ninthikal/g, "Shafi Campus");
  content = content.replace(/Sector /g, "Campus ");
  content = content.replace(/ Sector/g, " Campus");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
