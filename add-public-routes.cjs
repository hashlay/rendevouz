const fs = require('fs');
const path = require('path');
const p = path.join('server', 'routes.ts');
let content = fs.readFileSync(p, 'utf8');

const publicRoutes = `
// ==========================================
// 🌐 PUBLIC WEBSITE APIs
// ==========================================

// Public Event Settings
apiRouter.get('/public/settings', async (req, res) => {
  res.json(dbClient.get().eventSettings || {});
});

// Public Units
apiRouter.get('/public/units', async (req, res) => {
  res.json(dbClient.get().units.filter(u => u.active));
});

// Public Categories
apiRouter.get('/public/categories', async (req, res) => {
  res.json(dbClient.get().categories.filter(c => c.active));
});

// Public Competitions
apiRouter.get('/public/competitions', async (req, res) => {
  res.json(dbClient.get().competitions.filter(c => c.active));
});

// Public Published Results
apiRouter.get('/public/results', async (req, res) => {
  const db = dbClient.get();
  
  const enrichedResults = db.results
    .filter(r => !r.deletedAt && r.publishedStatus)
    .map(r => {
      const comp = db.competitions.find(c => c.id === r.competitionId);
      const cat = db.categories.find(c => c.id === r.categoryId);
      
      let participantName = '';
      let codeNumber = '';
      let department = '';
      let participationType = comp?.participationType === 'group' ? 'Group' : 'Individual';
      
      if (r.participantId) {
        const p = db.participants.find(p => p.id === r.participantId);
        if (p) {
          participantName = p.fullName;
          const chest = db.chestNumbers.find(c => c.participantId === p.id && c.categoryId === p.selectedCategoryId);
          codeNumber = chest ? chest.chestNumber.toString() : '';
          const unit = db.units.find(u => u.id === p.unitId);
          department = unit ? unit.name : '';
        }
      } else if (r.teamId) {
        const t = db.teams.find(t => t.id === r.teamId);
        if (t) {
          participantName = t.teamName || t.teamNumber;
          codeNumber = t.teamNumber;
          const unit = db.units.find(u => u.id === t.unitId);
          department = unit ? unit.name : '';
        }
      }
      
      // Calculate points dynamically based on rank and eventSettings
      let points = 0;
      let grade = '';
      if (r.rank === 1) points = db.eventSettings.globalPointsRank1 || 20;
      else if (r.rank === 2) points = db.eventSettings.globalPointsRank2 || 15;
      else if (r.rank === 3) points = db.eventSettings.globalPointsRank3 || 10;
      
      if (r.totalMark >= 90) grade = 'A+';
      else if (r.totalMark >= 80) grade = 'A';
      else if (r.totalMark >= 70) grade = 'B+';
      else grade = 'B';
      
      return {
        id: r.id,
        eventName: comp ? comp.name : 'Unknown',
        category: cat ? cat.name : 'Unknown',
        participationType,
        participantName,
        codeNumber,
        department,
        rank: r.rank || 0,
        grade,
        points,
        // Also send raw data for Poster Studio
        raw: r
      };
    });
    
  res.json(enrichedResults);
});

// Participant Auth
apiRouter.post('/public/auth/participant-login', async (req, res) => {
  const { chestNumber, dob } = req.body;
  const db = dbClient.get();
  
  const cNum = db.chestNumbers.find(c => c.chestNumber.toString() === chestNumber);
  if (!cNum) return res.status(401).json({ error: 'Invalid Chest Number' });
  
  const participant = db.participants.find(p => p.id === cNum.participantId && !p.deletedAt);
  if (!participant) return res.status(401).json({ error: 'Participant not found' });
  
  if (participant.dob !== dob) return res.status(401).json({ error: 'Incorrect Date of Birth' });
  
  const token = jwt.sign({ participantId: participant.id, role: 'participant' }, JWT_SECRET || 'fallback', { expiresIn: '8h' });
  res.json({ token, participant });
});

apiRouter.get('/public/participant/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET || 'fallback') as any;
    if (decoded.role !== 'participant') return res.status(403).json({ error: 'Forbidden' });
    
    const participant = dbClient.get().participants.find(p => p.id === decoded.participantId && !p.deletedAt);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });
    
    res.json({ participant });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
`;

if (!content.includes('/public/results')) {
  fs.writeFileSync(p, content + publicRoutes);
  console.log('Appended public routes!');
} else {
  console.log('Routes already exist.');
}
