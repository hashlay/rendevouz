const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://sector:yeSylxbrrUo9r6TV@sector.pvd9le6.mongodb.net/?appName=sector";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  
  try {
    await client.connect();
    const dbName = 'sector';
    const mongoDb = client.db(dbName);
    const mongoCollection = mongoDb.collection('app_state');
    
    const existingState = await mongoCollection.findOne({ _id: 'global_state' });
    if (!existingState) {
      console.log("No state found in MongoDB");
      return;
    }
    
    const db = existingState;
    const activeComps = (db.competitions || []).filter(c => c.active);
    let pendingCount = 0;
    const pendingDetails = [];

    for (const comp of activeComps) {
      if (comp.participationType === 'individual') {
        const regsInComp = (db.registrations || []).filter(r => r.selectedIndividualCompetitionIds && r.selectedIndividualCompetitionIds.includes(comp.id));
        for (const r of regsInComp) {
          const p = (db.participants || []).find(part => part.id === r.participantId);
          if (p && !p.deletedAt) {
            const res = (db.results || []).find(res => res.competitionId === comp.id && res.participantId === p.id && !res.deletedAt);
            if (!res) {
              pendingCount++;
              pendingDetails.push(`[Individual] Competition: ${comp.name} | Participant: ${p.fullName} (ID: ${p.id})`);
            }
          }
        }
      } else {
        const activeTeams = (db.teams || []).filter(t => t.competitionId === comp.id && !t.deletedAt);
        for (const t of activeTeams) {
          const res = (db.results || []).find(res => res.competitionId === comp.id && res.teamId === t.id && !res.deletedAt);
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
    
  } catch(e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
main();
