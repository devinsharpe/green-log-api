const { getUnixTime } = require("date-fns");
const { ObjectId } = require("mongodb");
const fp = require("fastify-plugin");

async function configureAuthenticate(fastify, opts, done) {
  fastify.decorate("authenticate", async function (req, reply) {
    try {
      console.log(req.headers);
      let token;
      if (req.cookies.token) {
        token = await fastify.jwt.decode(
          fastify.unsignCookie(req.cookies.token).value
        );
      } else if (req.headers.authorization) {
        token = await fastify.jwt.decode(
          req.headers.authorization.replace("Bearer ", "")
        );
      } else {
        reply
          .code(401)
          .send({ error: "Access denied. Please login to continue." });
        return;
      }
      console.log(token);
      let session = await fastify.mongo.db.collection("sessions").findOne({
        _id: ObjectId(token.session),
        expiresAt: { $gt: getUnixTime(new Date()) },
      });
      let user = await fastify.mongo.db
        .collection("users")
        .findOne({ _id: ObjectId(token.user) });
      if (session === null || user === null) {
        reply
          .code(401)
          .send({ error: "Access denied. Please login to continue." });
      } else {
        req.user = user;
        req.session = session;
      }
    } catch (err) {
      console.log(err);
      reply
        .code(401)
        .send({ error: "Access denied. Please login to continue." });
    }
  });
  done();
}

module.exports = fp(configureAuthenticate);
