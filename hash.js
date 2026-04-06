const bcrypt = require("bcryptjs");

(async () => {
  const hash = await bcrypt.hash("samuel", 10);
  console.log("HASH PASSWORD:", hash);
})();