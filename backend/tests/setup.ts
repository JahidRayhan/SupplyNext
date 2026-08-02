import dotenv from "dotenv";

// Point every test file at the isolated sdcip_test database instead of dev.
dotenv.config({ path: ".env.test", override: true });
