import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let telemetrySdk: NodeSDK | null = null;

export function startTelemetry(): void {
  if (telemetrySdk || process.env.OTEL_ENABLED === 'false') {
    return;
  }

  const shouldDebug = process.env.OTEL_DEBUG === 'true';
  if (shouldDebug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  telemetrySdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  telemetrySdk.start();
}

export async function stopTelemetry(): Promise<void> {
  if (!telemetrySdk) {
    return;
  }

  await telemetrySdk.shutdown();
  telemetrySdk = null;
}
