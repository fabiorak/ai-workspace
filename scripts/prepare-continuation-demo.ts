import { continuationFixture } from "../apps/web/test/continuation-fixture.ts";
// Deliberately retain this synthetic temporary home for manual GUI review.
const fixture = await continuationFixture();
process.stdout.write(
  JSON.stringify(
    {
      home: fixture.home,
      repository: fixture.repository,
      projectId: fixture.project.id,
      conversationId: fixture.query.conversationId,
      profile: fixture.target.profile,
      bundles: fixture.target.bundles,
      policy: fixture.target.policy,
      model: fixture.target.model,
      start: `AI_WORKSPACE_HOME='${fixture.home}' npm run gui`,
      stop: "Ctrl+C",
    },
    null,
    2,
  ) + "\n",
);
