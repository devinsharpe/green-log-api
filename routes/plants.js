const { ObjectID } = require("mongodb");

async function routes(fastify, options) {
  fastify.get(
    "/popular/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                trefleId: { type: "string" },
                scientificName: { type: "string" },
                commonName: { type: "string" },
                familyCommonName: { type: "string" },
                popularity: { type: "number" },
                commonNames: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
    async function (req, reply) {
      let plants = await this.mongo.db
        .collection("plants")
        .find({ commonName: { $exists: true } })
        .sort({ popularity: -1, _id: 1 })
        .limit(10)
        .toArray();
      reply.code(200).send(plants);
    }
  );

  fastify.get(
    "/search/:keyword/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    trefleId: { type: "string" },
                    scientificName: { type: "string" },
                    commonName: { type: "string" },
                    familyCommonName: { type: "string" },
                    popularity: { type: "number" },
                    commonNames: { type: "array", items: { type: "string" } },
                  },
                },
              },
              page: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        },
      },
    },
    async function (req, reply) {
      let searchCursor = await this.mongo.db
        .collection("plants")
        .find(
          { $text: { $search: req.params.keyword } },
          { score: { $meta: "searchScore" } }
        )
        .sort({ score: -1 });
      let pageCount = Math.ceil((await searchCursor.count()) / 10);
      let plants;
      if (req.query.page && Number(req.query.page) > 1) {
        plants = await searchCursor
          .skip(10 * (Number(req.query.page) - 1))
          .limit(10)
          .toArray();
      } else {
        plants = await searchCursor.limit(10).toArray();
      }
      reply.code(200).send({
        results: plants,
        page: req.query.page ? req.query.page : 1,
        totalPages: pageCount,
      });
    }
  );

  fastify.get("/id/:id/", async function (req, reply) {
    let plant = await this.mongo.db
      .collection("plants")
      .findOne({ _id: ObjectID(req.params.id) });
    reply.code(200).send(plant);
  });
}

module.exports = routes;
