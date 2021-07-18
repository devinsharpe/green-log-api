const { MongoClient, ObjectId } = require("mongodb");

const connectDB = async () => {
  const db = new MongoClient(
    `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_SERVER}/${process.env.MONGO_DB}?authSource=admin&readPreference=primary&ssl=false`,
    { useUnifiedTopology: true }
  );
  await db.connect();
  return db;
};

module.exports = connectDB;
