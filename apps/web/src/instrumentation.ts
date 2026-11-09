import { registerOTel } from "@vercel/otel";

/**
 * Sends a trace of every request to Dash0 (OpenTelemetry), including the Elasticsearch queries and maps calls inside it.
 * Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set; in the cluster it comes from Secret `dash0` (deploy/web.yaml).
 */
export function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "web",
    attributes: { "service.namespace": "conpass", "service.version": process.env.APP_VERSION ?? "dev" },
    // Continue the trace into the maps service so web → maps shows as one trace.
    instrumentationConfig: { fetch: { propagateContextUrls: [/^http:\/\/maps(:\d+)?\//] } },
  });
}
