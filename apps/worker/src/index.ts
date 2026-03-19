/**
 * SyncCoreHub Background Worker
 * Processes BullMQ jobs for ICP scoring, webhook delivery, and email sending.
 */
import "dotenv/config";
import { icpScorerWorker } from "./workers/icp-scorer";
import { webhookDeliveryWorker } from "./workers/webhook-delivery";
import { createEmailWorker } from "./workers/email";
import { createCallRoutingSmsWorker } from "./workers/call-routing-sms";
import { createAppointmentConfirmationWorker } from "./workers/appointment-confirmation";

const emailWorker = createEmailWorker();
const callRoutingSmsWorker = createCallRoutingSmsWorker();
const appointmentConfirmationWorker = createAppointmentConfirmationWorker();
const workers = [
  icpScorerWorker,
  webhookDeliveryWorker,
  emailWorker,
  callRoutingSmsWorker,
  appointmentConfirmationWorker,
];

console.log("SyncCoreHub Worker started");
console.log("  ICP Scorer worker: active");
console.log("  Webhook Delivery worker: active");
console.log("  Email worker: active");
console.log("  Call Routing SMS worker: active");
console.log("  Appointment Confirmation worker: active");

// Graceful shutdown
async function shutdown() {
  console.log("\n⏹️  Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

workers.forEach((worker) => {
  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });
});
