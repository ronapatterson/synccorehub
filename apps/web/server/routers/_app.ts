import { router } from "../trpc";
import { customersRouter } from "./customers";
import { leadsRouter } from "./leads";
import { icpRouter } from "./icp";
import { segmentsRouter } from "./segments";
import { projectsRouter } from "./projects";
import { contractorsRouter } from "./contractors";
import { pluginsRouter } from "./plugins";
import { referralsRouter } from "./referrals";
import { analyticsRouter } from "./analytics";
import { productsRouter } from "./products";
import { webhooksRouter } from "./webhooks";
import { apiKeysRouter } from "./api-keys";
import { tenantsRouter } from "./tenants";
import { activitiesRouter } from "./activities";
import { portalUsersRouter } from "./portal-users";
import { callRoutingRouter } from "./call-routing";

export const appRouter = router({
  customers: customersRouter,
  leads: leadsRouter,
  icp: icpRouter,
  segments: segmentsRouter,
  projects: projectsRouter,
  contractors: contractorsRouter,
  plugins: pluginsRouter,
  referrals: referralsRouter,
  analytics: analyticsRouter,
  products: productsRouter,
  webhooks: webhooksRouter,
  apiKeys: apiKeysRouter,
  tenants: tenantsRouter,
  activities: activitiesRouter,
  portalUsers: portalUsersRouter,
  callRouting: callRoutingRouter,
});

export type AppRouter = typeof appRouter;
