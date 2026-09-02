import cors from 'cors';
import 'dotenv/config';
import 'express-async-errors';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';

import productsRoute from './routes/products';
import healthRoute from './routes/health';
import usersRoute from './routes/users';
import notificationsRoute from './routes/notifications';
import onchainRoute from './routes/onchain';
import farmsRoute from './routes/farms';
import ordersRoute from './routes/orders';
import authRoute from './routes/auth';
import eventsRoute from './routes/events';
import sellsRoute from './routes/sells';
import adminRoute from './routes/admin';
import stripeRoute from './routes/stripe';
import configRoute from './routes/config';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { withLogger } from './middleware/logger';
import { startOrderExpirationJob } from './jobs/OrderExpirationJob';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(requestId);
app.use(withLogger);

const allowedOrigins = [
  "http://localhost:3000",
  "https://app.cofiblocks.com",
  "https://app-test.cofiblocks.com",
];

function isAllowedPreviewOrigin(origin: string) {
  return origin.endsWith(".vercel.app");
}

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / curl / Stripe / webhooks
      if (!origin) return callback(null, true);

      // Always allow explicit trusted origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow ALL Vercel preview URLs in non-prod
      if (!isProduction && isAllowedPreviewOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.options("*", cors());

// IMPORTANT: Stripe webhook MUST come before express.json()
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" })
);


app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  req.log.info("******************* Incoming request *******************");
  req.log.info("Request for: " + req.method + " " + req.url);

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      req.log.info(`Response Status: ${res.statusCode}`);
    }
    req.log.info("******************* Request completed *******************");
  });

  next();
});


// APIs
app.use("/api/health", healthRoute);
app.use("/api/products", productsRoute);
app.use("/api/users", usersRoute);
app.use("/api/notifications", notificationsRoute);
app.use("/api/onchain", onchainRoute);
app.use("/api/farms", farmsRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/auth", authRoute);
app.use("/api/events", eventsRoute);
app.use("/api/sells", sellsRoute);
app.use("/api/admin", adminRoute);
app.use("/api/stripe", stripeRoute);
app.use("/api/config", configRoute);

// Error handling middleware (must be last)
app.use(errorHandlerMiddleware);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  startOrderExpirationJob();
});
