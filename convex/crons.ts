import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge expired trash",
  { hourUTC: 3, minuteUTC: 0 },
  internal.trash.purgeExpired
);

export default crons;
