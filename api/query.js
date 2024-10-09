// /api/read.js

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'err', message: 'Method Not Allowed', error: {} });
  }

  const { db, collection, fields, ...filters } = req.query;

  if (!db || !collection) {
    return res.status(400).json({ status: 'err', message: 'Missing "db" or "collection" parameter', error: {} });
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

    // Convert filter values to appropriate types if necessary
    Object.keys(filters).forEach(key => {
      // If filter is a regex (like filtering by name or any string field)
      if (key === 'name') {
        filters[key] = { $regex: filters[key], $options: 'i' }; // case-insensitive regex
      }

      // Example: Filter if field is a 2D array (adjust key based on your data structure)
      if (key === 'arrayField') {
        filters[key] = { $elemMatch: { $elemMatch: { $eq: filters[key] } } }; // Example for filtering inside a 2D array
      }

      // Example: Convert other fields to appropriate types, such as price to a number
      if (key === 'price') {
        filters[key] = Number(filters[key]);
      }
    });

    // Projection: To specify which fields to return
    let projection = {};
    if (fields) {
      const fieldList = fields.split(','); // "name,email,age" -> ['name', 'email', 'age']
      fieldList.forEach(field => {
        projection[field.trim()] = 1; // Include specified fields
      });
      projection._id = 0; // Exclude the _id field
    }

    const documents = await targetCollection.find(filters, { projection }).toArray();

    await client.close();

    res.status(200).json({
      status: 'ok',
      message: 'Success',
      data: documents
    });
  } catch (error) {
    console.error('Error in GET /read:', error);
    res.status(500).json({
      status: 'err',
      message: 'Fail',
      error: error.message
    });
  }
};
