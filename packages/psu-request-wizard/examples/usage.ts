import {runWizard} from "../src/index.js";

await runWizard({
  wizard: true,
  nhsNumber: "9991234567",
  businessStatus: "With Pharmacy",
  clipboard: false,
  send: false,
  saveDir: "./data/psu_requests"
});
