# OpenAI Responses live probe gate

Status: **offline preparation**. No live request is authorized by this
document. The live probe remains `NOT_RUN` until a separate review fixes the model, account,
current price, exact synthetic text, maximum cost and at most two requests.

The standard GUI start remains local. With no transport mode it reads no API key
and the conversation displays the labelled simulated response. External delivery
requires the exact process-level opt-in below:

```bash
AI_WORKSPACE_MODEL_TRANSPORT=OPENAI_RESPONSES \
OPENAI_API_KEY="provided-outside-the-repository" \
AI_WORKSPACE_HOME="/tmp/ai-workspace-live-probe" \
npm run gui
```

Do not run that command merely to test whether a credential or account works.
The live-probe review must happen first. Never put the key in Settings, a target, a file,
shell history, logs or a committed environment file.

The host accepts no other transport spelling. The adapter uses only the fixed
`https://api.openai.com/v1/responses` endpoint, refuses redirects, sends one
non-streaming request with no tools and no retry, and sets `store: false`. The
complete response body is bounded before parsing. Only a response whose top-level
status is `completed`, with bounded text and provider identifiers, can complete
the local attempt. Timeout, redirect, malformed data, incomplete/cancelled/failed
status or uncertain HTTP failure become `UNKNOWN_AFTER_EXPOSURE` and are never
retried automatically.

The ordinary conversation path fixes the first probe limits at 512 output tokens
and 30 seconds. The selected target still supplies its reviewed model, profile,
policy and instruction references; enabling the process transport does not create
or select a target and does not prove account access.

Before the live probe, prepare a review sheet containing:

- exact model and account/project;
- current official input, cached-input and output prices with observation date;
- exact first synthetic request after local protection;
- at most two total requests, zero retry and the second request reviewed only
  after the first response exists;
- 512 output tokens, 30-second timeout and a calculated maximum spend;
- Ctrl+C stop procedure and the location of aggregate-only local observations;
- expected checks for restored output, conversation persistence, second-turn
  context and unknown-outcome handling.

The current Responses schema documents `store`, `max_output_tokens`, usage and
the terminal statuses `completed`, `failed`, `cancelled` and `incomplete` in the
[official OpenAI API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).
