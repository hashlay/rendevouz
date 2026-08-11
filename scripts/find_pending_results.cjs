const fs = require('fs');

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));

const activeComps = db.competitions.filter(c => c.active);
let pendingCount = 0;
const pendingDetails = [];

for (const comp of activeComps) {
  if (comp.participationType === 'individual') {
    const regsInComp = (db.registrations || []).filter(r => r.selectedIndividualCompetitionIds && r.selectedIndividualCompetitionIds.includes(comp.id));
    for (const r of regsInComp) {
      const p = db.participants.find(part => part.id === r.participantId);
      if (p && !p.deletedAt) {
        // Expected a result for this participant in this competition
        const res = db.results.find(res => res.competitionId === comp.id && res.participantId === p.id && !res.deletedAt);
        if (!res) {
          pendingCount++;
          pendingDetails.push(`[Individual] Competition: ${comp.name} | Participant: ${p.fullName} (ID: ${p.id})`);
        }
      }
    }
  } else {
    const activeTeams = db.teams.filter(t => t.competitionId === comp.id && !t.deletedAt);
    for (const t of activeTeams) {
      const res = db.results.find(res => res.competitionId === comp.id && res.teamId === t.id && !res.deletedAt);
      if (!res) {
        pendingCount++;
        pendingDetails.push(`[Group] Competition: ${comp.name} | Team: ${t.teamName || t.teamNumber}`);
      }
    }
  }
}

console.log('Pending Count:', pendingCount);
console.log('Pending Entries:');
console.log(pendingDetails.join('\n'));
