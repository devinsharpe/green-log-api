const bcrypt = require("bcrypt");
const { add, getUnixTime } = require("date-fns");

async function routes(fastify, options) {
  fastify.get("/", async (req, reply) => {
    reply.code(200).send({ status: "alive" });
  });

  fastify.post(
    "/login/",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", nullable: false },
            password: { type: "string", nullable: false },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                },
              },
              token: { type: "string" },
              tokenExpiry: { type: "number" },
            },
          },
        },
      },
    },
    async function (req, reply) {
      let user;
      await this.mongo.db
        .collection("users")
        .find({ email: req.body.email.toLowerCase().trim() })
        .limit(1)
        .forEach((doc) => (user = doc));
      if (!user) {
        reply
          .code(400)
          .send({ error: "There is no user with that email and password." });
      } else {
        let isValidPassword = await bcrypt.compare(
          req.body.password,
          user.password
        );
        if (isValidPassword) {
          let token = await this.jwt.sign(
            { user: user._id },
            { expiresIn: `${process.env.JWT_TTL}s` }
          );
          let tokenExpiry = add(new Date(), { seconds: process.env.JWT_TTL });
          reply
            .code(200)
            .setCookie("token", token, {
              path: "/",
              signed: true,
              httpOnly: true,
              expires: tokenExpiry,
            })
            .send({
              user: { _id: user._id, email: user.email },
              token,
              tokenExpiry: getUnixTime(tokenExpiry),
            });
        } else {
          reply
            .code(400)
            .send({ error: "There is no user with that email and password." });
        }
      }
    }
  );

  fastify.post(
    "/signup/",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password", "passwordConfirm"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
            passwordConfirm: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                },
              },
              token: { type: "string" },
              tokenExpiry: { type: "number" },
            },
          },
        },
      },
    },
    async function (req, reply) {
      let isValidPassword =
        /^(?=.*\d)(?=.*[a-z])[\w~@#$%^&*+=`|{}:;!.?\"()\[\]-]{8,}$/gm.test(
          req.body.password
        ) && req.body.password === req.body.passwordConfirm;
      let oldUserCount = await this.mongo.db
        .collection("users")
        .find({ email: req.body.email.toLowerCase().trim() })
        .count();
      if (oldUserCount) {
        reply
          .code(400)
          .send({ error: "A user with that email address already exists." });
      } else if (!isValidPassword) {
        reply.code(400).send({
          error:
            "A more secure password is required. This password must contain letters and numbers; it must also be at leat 8 characters long.",
        });
      } else {
        let hash = await bcrypt.hash(
          req.body.password,
          Number(process.env.SALT_ROUNDS)
        );
        let userInsert = await this.mongo.db.collection("users").insertOne({
          email: req.body.email.toLowerCase().trim(),
          password: hash,
        });
        let user = null;
        await this.mongo.db
          .collection("users")
          .find({ _id: userInsert.insertedId })
          .limit(1)
          .forEach((doc) => {
            user = doc;
          });
        let token = await this.jwt.sign(
          { user: user._id },
          { expiresIn: `${process.env.JWT_TTL}s` }
        );
        let tokenExpiry = add(new Date(), { seconds: process.env.JWT_TTL });
        reply
          .code(200)
          .setCookie("token", token, {
            path: "/",
            signed: true,
            httpOnly: true,
            expires: tokenExpiry,
          })
          .send({
            user: {
              _id: user._id,
              email: user.email,
            },
            token,
            tokenExpiry: getUnixTime(tokenExpiry),
          });
      }
    }
  );
}

module.exports = routes;
