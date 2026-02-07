exports.handler = async () => {
  console.log("Scheduled check running...");

  return {
    statusCode: 200,
    body: "System healthy"
  };
};