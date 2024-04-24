const { S3 } = require("@aws-sdk/client-s3");
const fetch = require("node-fetch");
require("dotenv").config()

const cf = require("cloudflare")({
  email: process.env.CLOUDFLARE_EMAIL,
  key: process.env.CLOUDFLARE_KEY,
  token: process.env.CLOUDFLARE_TOKEN,
});

const s3 = new S3({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY,
    secretAccessKey: process.env.AWS_S3_SECRET_KEY,
  },
});

const deleteCloudflareRecord = async (siteUrl) => {
  try {
    const records = await getCloudflareRecord(siteUrl);

    if (records.length > 0) {
      const result = await cf.dnsRecords.del(
        process.env.CLOUDFLARE_ZONE_ID,
        records[0].id
      );
      console.log(result, "Deleted DNS record.");
      return true;
    } else {
      console.log("Cannot delete non existing DNS record.");
      return false;
    }
  } catch (err) {
    console.log(err.message);
    return false;
  }
};

const getCloudflareRecord = async (siteUrl) => {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records?type=CNAME&name=${siteUrl}&match=all`,
      {
        method: "GET",
        headers: {
          "X-Auth-Key": process.env.CLOUDFLARE_API_KEY,
          "X-Auth-Email": process.env.CLOUDFLARE_EMAIL,
        },
      }
    );

    const data = await res.json();

    return data.result;
  } catch (err) {
    console.log(err.message, "Cloudflare error message");
    return [];
  }
};

const checkBucketExists = async (bucket) => {
  try {
    await s3.headBucket({ Bucket: bucket });
    return true;
  } catch (err) {
    return false;
  }
};

const deleteBucket = async (site_url) => {
  const bucketParams = {
    Bucket: site_url,
  };

  try {
    const isBucketAvailable = await checkBucketExists(site_url);
    console.log("isBucketAvailable", isBucketAvailable);
    if (isBucketAvailable) {
      const { Contents } = await s3.listObjects(bucketParams);

      if (Contents?.length > 0) {
        await s3.deleteObjects({
          ...bucketParams,
          Delete: {
            Objects: Contents.map(({ Key }) => ({ Key })),
          },
        });
      }

      const res = await s3.deleteBucket(bucketParams);
      console.log(site_url, "Bucket deleted");
    } else {
      console.log("Bucket not found");
      return false;
    }

    return true;
  } catch (err) {
    console.log("Error while delete s3 bucket:", err.message);
    return false;
  }
};

// pass buckets names you want to delete from S3 bucket and Cloudflare in an array. Eg: ["xyz.altrunic.org"]
const buckets = [];

buckets.forEach(bucket => {
  deleteCloudflareRecord(bucket)
    .then((res) => console.log("Cloudflare record deleted:", res))
    .catch((e) => console.log("Error in cloudflare record deletion:", e));
  
  deleteBucket(bucket)
    .then((res) => console.log("bucket deleted", res))
    .catch((e) => console.log("error in bucket deletion", e));
})
