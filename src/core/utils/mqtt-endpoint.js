/**
 * Resolve the MQTT endpoint a core client dials (issue #45).
 *
 * Gateway, device and thing documents carry their broker address as literal
 * data — historically `localhost` plus the co-located loopback listener. When
 * TaS runs as its own container, the broker is a separate service and that
 * literal address no longer points at it, so the composed deployment exports
 * `TAS_MQTT_HOST` / `TAS_MQTT_PORT` and every core client resolves its
 * endpoint through here: an explicitly set environment variable overrides the
 * document's value, everything else keeps the documented value unchanged.
 *
 * With both variables unset — local development, tests — behaviour is exactly
 * what it was before this module existed.
 *
 * @param {Object} [mqttConfig] The document's connection config (`{host, port}`)
 * @returns {{host: String|Number, port: String|Number}} Endpoint to dial
 */
function resolveMqttEndpoint(mqttConfig) {
  const config = mqttConfig || {};
  return {
    host: process.env.TAS_MQTT_HOST || config.host,
    port: process.env.TAS_MQTT_PORT || config.port,
  };
}

module.exports = { resolveMqttEndpoint };
