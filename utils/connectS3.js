const aws = require("aws-sdk");

const connectS3 = () => {
  const s3 = new aws.S3({
    apiVersion: process.env.AWS_API_VERSION,
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT,
  });
  return new Promise((resolve, reject) => {
    aws.config.getCredentials(function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(s3);
      }
    });
  });
};

module.exports = connectS3;
