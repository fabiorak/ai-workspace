# ADR-0039: Start proactive restart proposals with two observable signals

**Status:** accepted

**Date:** 2026-09-04

## Context

ADR-0037 names three events at which the shell may bring a restart summary
forward. The proposal was intentionally deferred until real imported work existed.

The first read-only measurement over real local state found one explicitly linked
work with 226,164 imported bytes, 53 moments, one assistant, one kept restart
packet, and no moments after that packet. The only reviewed fixtures are 135 times
smaller. This is enough to choose a pilot that distinguishes the observed work
from fixtures, but not enough to present a statistically calibrated threshold.

The proposed “session from another assistant on the same work” signal is not
observable when the session appears. A session belongs to a Work Item only after a
person explicitly cites one of its events; inferring that relationship from a
project directory would make a different and noisier claim. Inactivity is also not
urgency: the measured work had been quiet for 41 days and was completely fixed.

## Decision

Amend ADR-0037's proactive proposal to start with two local, observable signals:

1. **Estimated context pressure.** A Work Item reaches the pilot threshold when
   the latest imported source artifacts of its explicitly linked sessions total at
   least 200 KiB (204,800 bytes). The interface calls this an estimate and does not
   display byte counts as ordinary product language.
2. **Material after the latest kept restart point.** When a Work Item has a kept
   packet, a session moment with a readable occurrence time later than that
   packet's creation time is unfixed material. A missing packet or timestamp does
   not assert this signal.

The shell states the applicable reason on the conversation row. The signal writes
nothing, opens nothing, steals no focus, and creates no packet; the existing row
gesture remains the way to open the conversation and review its restart point.

Do not implement inactivity or a different-assistant signal in this first slice.
Revisit the pilot threshold when several explicitly linked real works can be
measured. Changing it is a measured product adjustment, not a provider token-limit
claim.

## Consequences

- the one measured real work exercises the pressure signal while the tiny fixtures
  do not;
- a fully fixed work does not claim to have newer material;
- no relationship between a session and a Work Item is inferred;
- the same Work Item can make both reasons true, and the interface states both;
- future data may move or replace the 200 KiB pilot without changing persistence,
  handoff schemas, or provider integrations.
