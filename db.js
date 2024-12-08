const { MongoClient } = require("mongodb");

// Настройки подключения
const uri = "mongodb://127.0.0.1:27017"; // Локальный сервер MongoDB
const dbName = "mindCalcDB"; // Название базы данных

// Подключение к MongoDB
let db;
async function connectToDB() {
  if (!db) {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log("Успешное подключение к MongoDB!");
  }
  return db;
}

module.exports = { connectToDB };
