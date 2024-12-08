const readline = require("readline");
const { connectToDB } = require("./db"); // Подключение базы данных

async function showStats() {
  try {
    const db = await connectToDB();
    const collection = db.collection("trainings");

    // Получаем все тренировки
    const trainings = await collection.find().toArray();

    if (trainings.length === 0) {
      console.log("Нет данных для отображения статистики.");
      process.exit(0);
    }

    // Инициализируем статистику
    let totalExercises = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let totalTime = 0;
    let trainingWithTime = 0; // Количество тренировок с указанным временем выполнения
    const lastTraining = await collection
      .find({})
      .sort({ date: -1 }) // Сортировка по полю date в убывающем порядке
      .limit(1) // Ограничиваем результат одной последней записью
      .toArray();

    trainings.forEach((training) => {
      totalExercises += training.exercises.length;

      // Проверяем, есть ли поле totalTime
      if (typeof training.totalTime === "number") {
        totalTime += training.totalTime;
        trainingWithTime++;
      }

      training.exercises.forEach((exercise) => {
        if (exercise.result.startsWith("ПРАВИЛЬНО")) {
          correctAnswers++;
        } else {
          incorrectAnswers++;
        }
      });
    });

    const averageTime =
      trainingWithTime > 0
        ? (totalTime / trainingWithTime).toFixed(2)
        : "неизвестно";
    const correctPercentage = ((correctAnswers / totalExercises) * 100).toFixed(
      2
    );
    const incorrectPercentage = (
      (incorrectAnswers / totalExercises) *
      100
    ).toFixed(2);

    // Вывод статистики
    console.log("=== Статистика тренировок ===");
    console.log(`Всего тренировок: ${trainings.length}`);
    console.log(`Общее количество примеров: ${totalExercises}`);
    console.log(`Среднее время выполнения: ${averageTime} секунд`);
    console.log(`Процент правильных ответов: ${correctPercentage}%`);
    console.log(`Процент неправильных ответов: ${incorrectPercentage}%`);
    console.log("");

    // Вывод полного файла последней решённой тренировки
    if (lastTraining.length > 0) {
      const training = lastTraining[0];
      const formattedDate = new Date(training.date).toLocaleDateString(
        "ru-RU",
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }
      );

      console.log("Последняя решённая тренировка:");
      console.log(`Дата и время тренировки: ${formattedDate}`);
      console.log("Содержимое:");
      console.log(training.rawText || "Нет данных для отображения");
    } else {
      console.log("Нет данных о тренировках.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Ошибка при выводе статистики:", error);
    process.exit(1);
  }
}

// Обработка параметра --stats
if (process.argv.includes("--stats")) {
  showStats();
  return;
}

if (process.argv.includes("--history")) {
  viewHistory();
  return;
}

async function viewHistory() {
  try {
    const db = await connectToDB();
    const collection = db.collection("trainings");
    const trainings = await collection.find().toArray();

    console.log("История тренировок:");
    trainings.forEach((training, index) => {
      console.log(`\nТренировка #${index + 1}`);
      console.log(`Дата: ${training.date}`);
      console.log(`Время выполнения: ${training.totalTime} секунд`);
      training.exercises.forEach((exercise, i) => {
        console.log(`  ${i + 1}. ${exercise.example} = ${exercise.result}`);
      });
    });
  } catch (error) {
    console.error("Ошибка чтения истории:", error);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const n = parseInt(process.argv[2], 10) || 10; // Количество примеров по умолчанию 10
let examples = [];
let results = [];
let startTime;

// Генерация случайных чисел и примеров
function generateExamples(count) {
  const examples = [];
  for (let i = 0; i < count; i++) {
    let num1 = Math.floor(100 + Math.random() * 900);
    let num2 = Math.floor(100 + Math.random() * 900);
    const operator = i < count / 2 ? "+" : "-";

    // Корректируем для отрицательных результатов
    if (operator === "-" && num1 < num2) {
      [num1, num2] = [num2, num1];
    }

    const answer = operator === "+" ? num1 + num2 : num1 - num2;
    examples.push({ num1, num2, operator, answer });
  }
  return examples;
}

// Логика выполнения одного примера
function askExample(index) {
  if (index >= examples.length) {
    finishProgram();
    return;
  }

  const { num1, num2, operator, answer } = examples[index];
  console.log(`${num1} ${operator} ${num2} = ?`);

  let timeout = setTimeout(() => {
    console.clear();
    rl.question("Введите ваш ответ: ", (userInput) => {
      clearTimeout(timeout);
      const isCorrect = parseInt(userInput, 10) === answer;
      const result = isCorrect
        ? "ПРАВИЛЬНО!"
        : `НЕПРАВИЛЬНО! Правильный ответ: ${answer}`;
      console.log(result);
      results.push({ example: `${num1} ${operator} ${num2}`, result });
      askExample(index + 1);
    });
  }, 5000); // 5 секунд на ввод ответа
}

async function finishProgram() {
  const endTime = Date.now();
  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`Время выполнения: ${elapsedSeconds} секунд`);

  const resultsWithTime = {
    date: new Date(),
    totalTime: elapsedSeconds,
    exercises: results.map((r) => ({
      example: r.example,
      result: r.result,
    })),
    rawText:
      results.map((r) => `${r.example} = ${r.result}`).join("\n") +
      `\nВремя выполнения: ${elapsedSeconds} секунд`, // Добавляем полный текст
  };

  try {
    const db = await connectToDB();
    const collection = db.collection("trainings");
    await collection.insertOne(resultsWithTime);
    console.log("Результаты успешно сохранены в базу данных!");
  } catch (error) {
    console.error("Ошибка сохранения в MongoDB:", error);
  }

  process.exit(0);
}

// Обработка выхода
process.on("SIGINT", () => {
  console.log("\nПрограмма завершена досрочно. Результаты не сохранены.");
  process.exit(1);
});

// Запуск программы
examples = generateExamples(n);
startTime = Date.now();
askExample(0);
