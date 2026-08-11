import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("No MongoDB URI found in environment.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const dbName = mongoUri.includes('/') 
      ? (mongoUri.split('/').pop()?.split('?')[0] || 'sahityotsav')
      : 'sahityotsav';
    const db = client.db(dbName);

    console.log("Fetching global_state...");
    const globalState = await db.collection('app_state').findOne({ _id: 'global_state' });
    if (!globalState) {
      console.log("No global_state found. Nothing to migrate.");
      process.exit(0);
    }

    const collections = [
      'users', 'loginAudits', 'auditLogs', 'units', 'categories', 
      'competitions', 'participants', 'teams', 'results', 'registrations', 
      'chestNumbers', 'counters', 'greenRoomAssignments', 'judgmentSheets', 
      'judgeScores', 'videoHighlights', 'gallery', 'dragBlocks', 'heroMedia'
    ];

    for (const colName of collections) {
      if (globalState[colName] && Array.isArray(globalState[colName])) {
        const data = globalState[colName];
        if (data.length > 0) {
          // Replace 'id' with '_id' for MongoDB native indexing
          const formattedData = data.map((item: any) => {
            const { id, ...rest } = item;
            return { _id: id, ...rest };
          });
          
          console.log(`Migrating ${formattedData.length} documents to '${colName}' collection...`);
          try {
            await db.collection(colName).insertMany(formattedData, { ordered: false });
          } catch (err: any) {
             // Ignore duplicate key errors if already migrated
             if (err.code !== 11000) {
                 console.error(`Error migrating ${colName}:`, err.message);
             }
          }
        }
      }
    }

    // Settings are objects, not arrays
    if (globalState.cmsSettings) {
      console.log("Migrating cmsSettings...");
      await db.collection('settings').updateOne(
        { _id: 'cmsSettings' },
        { $set: globalState.cmsSettings },
        { upsert: true }
      );
    }

    if (globalState.eventSettings) {
      console.log("Migrating eventSettings...");
      await db.collection('settings').updateOne(
        { _id: 'eventSettings' },
        { $set: globalState.eventSettings },
        { upsert: true }
      );
    }

    console.log("Migration completed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.close();
  }
}

migrate();
