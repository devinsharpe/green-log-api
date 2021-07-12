const fastify = require("fastify")({ logger: true });
require("dotenv").config();

const start = async () => {
  try {
    await fastify
      .register(require("fastify-mongodb"), {
        url: `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_SERVER}/${process.env.MONGO_DB}?authSource=admin&readPreference=primary&ssl=false`,
        forceClose: true,
      })
      .register(require("fastify-cookie"), {
        secret: process.env.COOKIE_SECRET,
        parseOptions: {},
      })
      .register(require("fastify-jwt"), {
        secret: process.env.JWT_SECRET,
      })
      .register(require("./routes/auth"))
      .listen(5000, "0.0.0.0");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
