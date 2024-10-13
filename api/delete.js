// /api/delete.js

const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'err', message: 'Method Not Allowed', error: {} });
  }

  const { db, collection, ids } = req.body;

  if (!db || !collection || !ids) {
    return res.status(400).json({ status: 'err', message: 'Missing "db", "collection", or "ids" in request body', error: {} });
  }

  if (!Array.isArray(ids)) {
    return res.status(400).json({ status: 'err', message: '"ids" must be an array', error: {} });
  }

  try {
    await client.connect();
    const adminDb = client.db().admin();

    // List all databases
    const databases = await adminDb.listDatabases();
    const dbExists = databases.databases.some(database => database.name === db);

    if (!dbExists) {
      await client.close();
      return res.status(404).json({ status: 'err', message: `Database "${db}" not found`, error: {} });
    }

    const targetDb = client.db(db);

    // List all collections in the specified database
    const collections = await targetDb.listCollections().toArray();
    const collectionExists = collections.some(col => col.name === collection);

    if (!collectionExists) {
      await client.close();
      return res.status(404).json({ status: 'err', message: `Collection "${collection}" not found in database "${db}"`, error: {} });
    }

    const targetCollection = targetDb.collection(collection);

    // Convert string IDs to ObjectId and filter out invalid IDs
    const objectIds = ids.map(id => {
      try {
        return ObjectId(id);
      } catch (error) {
        return null;
      }
    }).filter(id => id !== null);

    if (objectIds.length === 0) {
      await client.close();
      return res.status(400).json({ status: 'err', message: 'No valid IDs provided', error: {} });
    }

    const result = await targetCollection.deleteMany({ _id: { $in: objectIds } });

    await client.close();

    res.status(200).json({
      status: 'ok',
      message: 'Success',
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error in POST /delete:', error);
    res.status(500).json({
      status: 'err',
      message: 'Fail',
      error: error.message
    });
  }
};
