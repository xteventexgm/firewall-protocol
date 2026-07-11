const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://firewall-protocol_db_user:admin@firewall-protocol.vzqx091.mongodb.net/?appName=Firewall-protocol';
const dbName = 'firewall_protocol';

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected successfully to MongoDB Atlas');
    const db = client.db(dbName);
    
    // Get collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections found:');
    collections.forEach(c => console.log(' - ' + c.name));

    // Let's check roles collection if it exists
    if (collections.some(c => c.name === 'roles')) {
      const rolesCount = await db.collection('roles').countDocuments();
      console.log(`\nFound 'roles' collection with ${rolesCount} documents.`);
      const sampleRoles = await db.collection('roles').find({}).limit(2).toArray();
      console.log('Sample roles:');
      console.log(JSON.stringify(sampleRoles, null, 2));
    } else {
      console.log('\nNo "roles" collection found in MongoDB. Roles are likely static in the codebase.');
    }
    
    // Check some other collections
    for (const c of collections) {
      if (c.name !== 'roles') {
        const count = await db.collection(c.name).countDocuments();
        console.log(`Collection '${c.name}' has ${count} documents.`);
      }
    }
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  } finally {
    await client.close();
  }
}

main();
