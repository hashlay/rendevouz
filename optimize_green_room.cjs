const fs = require('fs');

let content = fs.readFileSync('server/routes.ts', 'utf-8');

// Replace green-room/generate logic
const oldGenerate = content.match(/apiRouter\.post\('\/green-room\/generate',.*?\n\s*res\.json\(\{ message: \`Generated \$\{assignments\.length\} code assignments\`, assignments: enrichedAssignments \}\);\n\}\);/s);

if (!oldGenerate) {
  console.log("Could not find /green-room/generate block");
} else {
  const newGenerate = `apiRouter.post('/green-room/generate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitionId } = req.body;

  if (!competitionId) {
    return res.status(400).json({ error: 'competitionId is required.' });
  }

  const competition = db.competitions.find(c => c.id === competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found.' });
  }

  if (!db.greenRoomAssignments) db.greenRoomAssignments = [];

  // Check if already generated
  const existing = db.greenRoomAssignments.filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Green room codes already generated for this competition. Use regenerate to replace.' });
  }

  // OPTIMIZATION: Use Maps for fast lookups
  const participantMap = new Map((db.participants || []).filter(p => !p.deletedAt).map(p => [p.id, p]));
  const chestNumberMap = new Map((db.chestNumbers || []).filter((c: any) => !c.deletedAt).map((c: any) => [c.participantId, c]));
  const unitMap = new Map((db.units || []).map(u => [u.id, u]));
  const categoryMap = new Map((db.categories || []).map(c => [c.id, c]));
  const teamMap = new Map((db.teams || []).filter(t => !t.deletedAt).map(t => [t.id, t]));

  let entries: { participantId?: string; teamId?: string; chestNumber?: number }[] = [];

  if (competition.participationType === ParticipationType.INDIVIDUAL) {
    const registrations = (db.registrations || []).filter((r: any) => r.selectedIndividualCompetitionIds.includes(competitionId));
    for (const reg of registrations) {
      const participant = participantMap.get(reg.participantId);
      if (!participant) continue;
      const cn = chestNumberMap.get(participant.id);
      if (!cn) continue;
      entries.push({ participantId: participant.id, chestNumber: cn.chestNumber });
    }
  } else {
    const teams = (db.teams || []).filter(t => t.competitionId === competitionId && !t.deletedAt);
    for (const team of teams) {
      entries.push({ teamId: team.id });
    }
  }

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No registered participants/teams with chest numbers found for this competition.' });
  }

  // Shuffle entries randomly (Fisher-Yates)
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  // Assign code letters
  const assignments: GreenRoomAssignment[] = entries.map((entry, index) => ({
    id: \`gr_\${Date.now()}_\${Math.random().toString(36).substr(2, 5)}\`,
    competitionId,
    categoryId: competition.categoryId,
    participantId: entry.participantId,
    teamId: entry.teamId,
    chestNumber: entry.chestNumber,
    codeLetter: indexToCodeLetter(index),
    status: GreenRoomStatus.ASSIGNED,
    generatedBy: user.id,
    generatedAt: new Date().toISOString()
  }));

  db.greenRoomAssignments.push(...assignments);

  const categoryName = categoryMap.get(competition.categoryId)?.name || 'Unknown';
  
  const enrichedAssignments = assignments.map(a => {
    let participantName = '';
    let unitName = '';
    if (a.participantId) {
      const p = participantMap.get(a.participantId);
      participantName = p?.fullName || 'Unknown';
      unitName = unitMap.get(p?.unitId || '')?.name || 'Unknown';
    } else if (a.teamId) {
      const t = teamMap.get(a.teamId);
      participantName = t?.teamNumber || 'Unknown Team';
      unitName = unitMap.get(t?.unitId || '')?.name || 'Unknown';
    }
    return {
      ...a,
      competitionName: competition?.name || 'Unknown',
      categoryName,
      participantName,
      unitName
    };
  });

  await dbClient.logAudit(user.id, user.username, user.role, \`Generate Green Room Codes for \${competition.name}\`, 'GreenRoom', competitionId);
  await dbClient.save();

  res.json({ message: \`Generated \${assignments.length} code assignments\`, assignments: enrichedAssignments });
});`;

  content = content.replace(oldGenerate[0], newGenerate);
}


// Replace green-room/regenerate logic
const oldRegenerate = content.match(/apiRouter\.post\('\/green-room\/regenerate',.*?\n\s*res\.json\(\{ message: \`Regenerated \$\{assignments\.length\} code assignments\`, assignments: enrichedAssignments \}\);\n\}\);/s);

if (!oldRegenerate) {
  console.log("Could not find /green-room/regenerate block");
} else {
  const newRegenerate = `apiRouter.post('/green-room/regenerate', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER]), async (req, res) => {
  const db = dbClient.get();
  const user = (req as any).user as User;
  const { competitionId } = req.body;

  if (!competitionId) {
    return res.status(400).json({ error: 'competitionId is required.' });
  }

  const competition = db.competitions.find(c => c.id === competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found.' });
  }

  if (!db.greenRoomAssignments) db.greenRoomAssignments = [];

  // Delete existing
  const existing = db.greenRoomAssignments.filter((a: GreenRoomAssignment) => a.competitionId === competitionId && !a.deletedAt);
  existing.forEach((a: GreenRoomAssignment) => {
    a.deletedAt = new Date().toISOString();
    a.deletedBy = user.id;
  });

  // OPTIMIZATION: Use Maps for fast lookups
  const participantMap = new Map((db.participants || []).filter(p => !p.deletedAt).map(p => [p.id, p]));
  const chestNumberMap = new Map((db.chestNumbers || []).filter((c: any) => !c.deletedAt).map((c: any) => [c.participantId, c]));
  const unitMap = new Map((db.units || []).map(u => [u.id, u]));
  const categoryMap = new Map((db.categories || []).map(c => [c.id, c]));
  const teamMap = new Map((db.teams || []).filter(t => !t.deletedAt).map(t => [t.id, t]));

  let entries: { participantId?: string; teamId?: string; chestNumber?: number }[] = [];

  if (competition.participationType === ParticipationType.INDIVIDUAL) {
    const registrations = (db.registrations || []).filter((r: any) => r.selectedIndividualCompetitionIds.includes(competitionId));
    for (const reg of registrations) {
      const participant = participantMap.get(reg.participantId);
      if (!participant) continue;
      const cn = chestNumberMap.get(participant.id);
      if (!cn) continue;
      entries.push({ participantId: participant.id, chestNumber: cn.chestNumber });
    }
  } else {
    const teams = (db.teams || []).filter(t => t.competitionId === competitionId && !t.deletedAt);
    for (const team of teams) {
      entries.push({ teamId: team.id });
    }
  }

  if (entries.length === 0) {
    await dbClient.save(); // Save deletions
    return res.status(400).json({ error: 'Existing codes deleted, but no registered participants/teams found to generate new ones.' });
  }

  // Shuffle entries randomly (Fisher-Yates)
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  // Assign code letters
  const assignments: GreenRoomAssignment[] = entries.map((entry, index) => ({
    id: \`gr_\${Date.now()}_\${Math.random().toString(36).substr(2, 5)}\`,
    competitionId,
    categoryId: competition.categoryId,
    participantId: entry.participantId,
    teamId: entry.teamId,
    chestNumber: entry.chestNumber,
    codeLetter: indexToCodeLetter(index),
    status: GreenRoomStatus.ASSIGNED,
    generatedBy: user.id,
    generatedAt: new Date().toISOString()
  }));

  db.greenRoomAssignments.push(...assignments);

  const categoryName = categoryMap.get(competition.categoryId)?.name || 'Unknown';
  
  const enrichedAssignments = assignments.map(a => {
    let participantName = '';
    let unitName = '';
    if (a.participantId) {
      const p = participantMap.get(a.participantId);
      participantName = p?.fullName || 'Unknown';
      unitName = unitMap.get(p?.unitId || '')?.name || 'Unknown';
    } else if (a.teamId) {
      const t = teamMap.get(a.teamId);
      participantName = t?.teamNumber || 'Unknown Team';
      unitName = unitMap.get(t?.unitId || '')?.name || 'Unknown';
    }
    return {
      ...a,
      competitionName: competition?.name || 'Unknown',
      categoryName,
      participantName,
      unitName
    };
  });

  await dbClient.logAudit(user.id, user.username, user.role, \`Regenerate Green Room Codes for \${competition.name}\`, 'GreenRoom', competitionId);
  await dbClient.save();

  res.json({ message: \`Regenerated \${assignments.length} code assignments\`, assignments: enrichedAssignments });
});`;

  content = content.replace(oldRegenerate[0], newRegenerate);
}

fs.writeFileSync('server/routes.ts', content);
console.log("Updated server/routes.ts");
