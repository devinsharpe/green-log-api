const bcrypt = require("bcrypt");
const { add, getUnixTime } = require("date-fns");
const { ObjectID } = require("mongodb");

async function routes(fastify, options) {
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
              account: {
                type: "object",
                nullable: true,
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  home: {
                    type: "object",
                    nullable: true,
                    properties: {
                      _id: { type: "string" },
                      name: { type: "string" },
                      admin: { type: "string" },
                      count: { type: "number" },
                    },
                  },
                },
              },
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
      let user = await this.mongo.db
        .collection("users")
        .findOne({ email: req.body.email.toLowerCase().trim() });
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
          let account = await this.mongo.db
            .collection("accounts")
            .findOne({ _id: user._id });
          let home;
          if (account) {
            home = await this.mongo.db
              .collection("homes")
              .findOne({ _id: account.home });
          }
          let sessionId = await this.utils.createSession(user);
          let [token, expiry] = await this.utils.createToken(
            user._id,
            sessionId
          );
          reply
            .code(200)
            .setCookie("token", token, {
              path: "/",
              signed: true,
              httpOnly: true,
              expires: expiry,
            })
            .send({
              account: account ? { ...account, home } : null,
              user: { _id: user._id, email: user.email },
              token,
              tokenExpiry: getUnixTime(expiry),
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
      let oldUser = await this.mongo.db
        .collection("users")
        .findOne({ email: req.body.email.toLowerCase().trim() });
      if (oldUser) {
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
        let user = await this.mongo.db
          .collection("users")
          .findOne({ _id: userInsert.insertedId });
        let sessionId = await this.utils.createSession(user._id);
        let [token, expiry] = await this.utils.createToken(user._id, sessionId);
        reply
          .code(200)
          .setCookie("token", token, {
            path: "/",
            signed: true,
            httpOnly: true,
            expires: expiry,
          })
          .send({
            user: {
              _id: user._id,
              email: user.email,
            },
            token,
            tokenExpiry: getUnixTime(expiry),
          });
      }
    }
  );

  fastify.post(
    "/account/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["name", "homeName"],
          properties: {
            name: { type: "string" },
            homeName: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              _id: { type: "string" },
              name: { type: "string" },
              home: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  admin: { type: "string" },
                  count: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async function (req, reply) {
      let oldAccount = await this.mongo.db
        .collection("accounts")
        .findOne({ _id: ObjectID(req.user._id) });
      if (oldAccount) {
        reply
          .code(403)
          .send({ error: "An account already exists with this user." });
      } else {
        let homeInsert = await this.mongo.db.collection("homes").insertOne({
          name: req.body.homeName,
          admin: req.user._id,
          count: 0,
        });
        let home = await this.mongo.db
          .collection("homes")
          .findOne({ _id: homeInsert.insertedId });
        let accountInsert = await this.mongo.db
          .collection("accounts")
          .insertOne({
            _id: req.user._id,
            email: req.user.email,
            name: req.body.name,
            home: home._id,
          });
        let account = await this.mongo.db
          .collection("accounts")
          .findOne({ _id: ObjectID(accountInsert.insertedId) });
        reply.code(200).send({ ...account, home });
      }
    }
  );

  fastify.get(
    "/user/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                nullable: true,
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                },
              },
              account: {
                type: "object",
                nullable: true,
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  home: {
                    type: "object",
                    nullable: true,
                    properties: {
                      _id: { type: "string" },
                      name: { type: "string" },
                      admin: { type: "string" },
                      count: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async function (req, reply) {
      let account = await this.mongo.db
        .collection("accounts")
        .findOne({ _id: req.user._id });
      let home = null;
      if (account.home) {
        home = await this.mongo.db
          .collection("homes")
          .findOne({ _id: account.home });
      }
      reply.code(200).send({
        user: { ...req.user, password: undefined },
        account: { ...account, home },
      });
    }
  );
}

module.exports = routes;
