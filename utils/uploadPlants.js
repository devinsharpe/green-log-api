const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const neatCsv = require("neat-csv");
const ora = require("ora");

const connectDB = require("./connectDB");

const formatPlant = (plant) => {
  return {
    trefleId: plant.id,
    scientificName: plant.scientific_name,
    genus: plant.genus,
    family: plant.family,
    commonName: plant.common_name,
    familyCommonName: plant.family_common_name,
    imageURL: plant.image_url,
    flower: {
      color: plant.flower_color,
      conspicuous: plant.flower_conspicuous === "true",
    },
    foliage: {
      color: plant.foliage_color,
      conspicuous: plant.foliage_conspicuous === "true",
    },
    fruit: {
      color: plant.fruit_color,
      conspicuous: plant.fruit_conspicuous === "true",
    },
    bloomMonths:
      plant.bloom_months !== ""
        ? plant.bloom_months.toUpperCase().split(",")
        : [],
    humidity: {
      ground:
        plant.ground_humidity !== undefined
          ? Number(plant.ground_humidity)
          : -1,
      atmospheric:
        plant.atmospheric_humidity !== undefined
          ? Number(plant.atmospheric_humidity)
          : -1,
    },
    growth: {
      form: plant.growth_form,
      habit: plant.growth_habit,
      months:
        plant.growth_months !== ""
          ? plant.growth_months.toUpperCase().split(",")
          : [],
      rate: plant.growth_rate,
    },
    isVegetable: plant.vegetable,
    isEdible: plant.edible,
    light: plant.light !== undefined ? Number(plant.light) : -1,
    soil: {
      nutriments:
        plant.soil_nutriments !== undefined
          ? Number(plant.soil_nutriments)
          : -1,
      salinity:
        plant.soil_salinity !== undefined ? Number(plant.soil_salinity) : -1,
    },
    height: {
      avg:
        plant.average_height_cm !== undefined
          ? Number(plant.average_height_cm)
          : -1,
      max:
        plant.maximum_height_cm !== undefined
          ? Number(plant.maximum_height_cm)
          : -1,
      min:
        plant.minimum_height_cm !== undefined
          ? Number(plant.minimum_height_cm)
          : -1,
    },
    ph: {
      max: plant.ph_maximum !== undefined ? Number(plant.ph_maximum) : -1,
      min: plant.ph_minimum !== undefined ? Number(plant.ph_minimum) : -1,
    },
    synonyms: plant.synonyms !== "" ? plant.synonyms.split(",") : [],
    commonNames: plant.common_names !== "" ? plant.common_names.split(",") : [],
    urls: {
      usda: plant.url_usda,
      plantnet: plant.url_plantnet,
      wiki: plant.url_wikipedia_en,
    },
  };
};

const main = async () => {
  let dbConnectSpinner = ora("Connecting to DB").start();
  const db = await connectDB();
  dbConnectSpinner.stop();

  let fileReadSpinner = ora("Reading species.csv").start();
  let rawData = await fs.promises.readFile("./utils/data/species.csv");
  const plantData = (await neatCsv(rawData, { separator: "\t" }))
    .filter((plant) => Boolean(plant.image_url) && plant.rank === "species")
    .map((plant) => {
      return formatPlant(plant);
    });
  fileReadSpinner.stop();
  let batchSize = 1000;
  const batches = [];
  while (plantData.length) {
    batches.push(plantData.splice(0, batchSize));
  }
  for (const [index, batch] of batches.entries()) {
    try {
      await db.db(process.env.MONGO_DB).collection("plants").insertMany(batch);
      console.log(`✓ Batch: ${index} | ${batch[0].trefleId}`);
    } catch (err) {
      console.log(err);
      console.log(`✕ Batch: ${index} | ${batch[0].trefleId}`);
      break;
    }
  }
  process.exit(0);
};

main();
