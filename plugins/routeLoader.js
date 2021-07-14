const fs = require("fs");
const path = require("path");
const fastifyPlugin = require("fastify-plugin");

async function routeLoader(fastify, opts, done) {
  const buildPrefix = (f) => {
    let dirs = f.toString().split(path.sep);
    let routeIndex = dirs.indexOf("routes");
    let prefix = "/";
    dirs.slice(routeIndex + 1).forEach((val) => {
      if (val.slice(0, 1) === "*" || val === "index.js") {
        return;
      } else if (val.slice(0, 1) === "_") {
        prefix += ":" + val.slice(1).split(".")[0] + "/";
      } else {
        prefix += val.replace("/").split(".")[0] + "/";
      }
    });
    return prefix;
  };

  const fileLoop = async (f) => {
    let isDir = (await fs.promises.stat(f)).isDirectory();
    if (isDir) {
      let contents = await fs.promises.readdir(f);
      let { files, directories } = contents.reduce(
        (acc, curr) => {
          let p = path.join(f, curr);
          if (fs.statSync(p).isDirectory()) {
            acc.directories.push(p);
          } else {
            acc.files.push(p);
          }
          return acc;
        },
        {
          files: [],
          directories: [],
        }
      );
      files.forEach((file) =>
        fastify.register(require(file), { prefix: buildPrefix(file) })
      );
      for (dir of directories) {
        await fileLoop(dir);
      }
    } else {
      fastify.register(require(f), { prefix: buildPrefix(f) });
    }
  };

  let routesDir = path.resolve(__dirname, "..", "routes/");
  try {
    await fileLoop(routesDir);
  } catch (err) {
    console.log(err);
  }
  done();
}

module.exports = fastifyPlugin(routeLoader);
