const { MongoClient } = require("mongodb");

async function migrate() {
  const client = new MongoClient("mongodb://localhost:27017"); // подключение к MongoDB
  try {
    await client.connect();
    const db = client.db("mindCalcDB");
    const collection = db.collection("trainings");

    // Обновление всех записей, которые не содержат поле rawText
    const cursor = collection.find({ rawText: { $exists: false } });
    const count = await cursor.count();
    console.log(`Найдено записей без поля rawText: ${count}`);

    const cursor1 = collection.find({});
    const trainings = await cursor1.toArray();
    console.log("Все записи в базе данных:", trainings);

    while (await cursor.hasNext()) {
      const training = await cursor.next();
      const updatedText =
        training.exercises.map((r) => `${r.example} = ${r.result}`).join("\n") +
        `\nВремя выполнения: ${training.totalTime} секунд`;

      // Обновляем запись, добавляя поле rawText
      await collection.updateOne(
        { _id: training._id },
        {
          $set: { rawText: updatedText },
        }
      );

      console.log(`Обновлена тренировка с ID: ${training._id}`);
    }

    console.log("Миграция завершена.");
  } catch (error) {
    console.error("Ошибка миграции:", error);
  } finally {
    await client.close();
  }
}

migrate();
