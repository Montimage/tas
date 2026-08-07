/**
 * The liveness probe.
 *
 * Deliberately the thinnest possible endpoint, and deliberately the only one
 * outside the authentication gate that an anonymous caller may read. A
 * container orchestrator, a load balancer or an uptime monitor has to be able
 * to ask "is this process answering?" without holding a credential, so this
 * answers exactly that and nothing else.
 *
 * It reports no uptime, no version, no build identifier and no dependency
 * status: every one of those is reconnaissance handed to an anonymous caller,
 * and none of them is needed to decide whether the process is alive. The
 * operational detail lives behind the gate, on the existing `/status` routes.
 */
const express = require("express");
const { validate } = require("../middleware/validate");
const { errorHandler } = require("../middleware/errors");

const router = express.Router();

router.get("/", validate(), (req, res) => {
  res.json({ status: "ok" });
});

router.use(errorHandler);

module.exports = router;
