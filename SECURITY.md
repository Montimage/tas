# Security Policy

## Supported versions

The project is developed and distributed through the `master` branch and tagged
releases published as the `ghcr.io/montimage/tas` container image. Security fixes
are released against the current stable release and incorporated into `master`.

## Reporting a vulnerability

Please report security issues **privately** so we can coordinate a fix before
they are made public. Use the GitHub **private vulnerability reporting** channel
for this repository:

- https://github.com/Montimage/tas/security/advisories/new

Do **not** open a public issue or pull request for an undisclosed
vulnerability.

When you report, please include:

- The affected component (e.g. web dashboard, REST API, MQTT broker, Node-RED).
- The version, image tag, or commit you tested against.
- A minimal reproduction (steps, payload, or scenario).
- The impact you observed and any suggested fix, if you have one.

## Response timeline

We aim to acknowledge all reports within 5 business days and to respond with a
triage assessment as soon as we can. Depending on severity, a patch may be
released as part of the next stable release or as a dedicated one.

## Known limitations

The API requires an authenticated session: there is a single administrator
account, provisioned from configuration rather than from this repository, and
every other caller is refused. There are no roles or per-user accounts —
anyone holding the administrator credential can do everything — so operate
the service on loopback or a trusted private network only, per the
[deployment baseline](README.md#deployment-baseline). The MQTT broker
requires authentication on its published port; the Node-RED editor has no
credential of its own and must not be exposed to untrusted networks.
