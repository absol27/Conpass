if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  await import("@opentelemetry/auto-instrumentations-node/register");
}
