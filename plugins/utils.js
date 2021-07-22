const fastifyPlugin = require("fastify-plugin");

const { add, getUnixTime } = require("date-fns");

async function utilsLoader(fastify, opts, done) {
  const createSession = async (user) => {
    let sessionInsert = await fastify.mongo.db
      .collection("sessions")
      .insertOne({
        user: user._id,
        createdAt: getUnixTime(new Date()),
        expiresAt: getUnixTime(
          add(new Date(), { seconds: process.env.JWT_TTL })
        ),
      });
    return sessionInsert.insertedId;
  };

  const createToken = async (userId, sessionId) => {
    let token = await fastify.jwt.sign(
      { user: userId, session: sessionId },
      { expiresIn: `${process.env.JWT_TTL}s` }
    );
    let tokenExpiry = add(new Date(), { seconds: process.env.JWT_TTL });
    return [token, tokenExpiry];
  };

  fastify.decorate("utils", { createSession, createToken });
  done();
}

module.exports = fastifyPlugin(utilsLoader);
