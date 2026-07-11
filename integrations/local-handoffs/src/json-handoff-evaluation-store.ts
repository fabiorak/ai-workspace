import { createHash } from "node:crypto";
import { chmod, mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  HandoffError,
  type HandoffEvaluation,
  type HandoffEvaluationStore,
} from "@ai-workspace/handoff";
export class JsonHandoffEvaluationStore implements HandoffEvaluationStore {
  readonly #directory: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "handoff-evaluations");
  }
  public async create(value: HandoffEvaluation) {
    const digest = createHash("sha256")
        .update(
          `${value.projectId}\0${value.workItemId}\0${value.handoffId}\0${value.id}`,
        )
        .digest("hex"),
      path = join(this.#directory, `evaluation_${digest}.json`);
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const file = await open(path, "wx", 0o600);
      try {
        await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
        await file.sync();
      } finally {
        await file.close();
      }
      return value;
    } catch (error) {
      await rm(path, { force: true }).catch(() => undefined);
      throw new HandoffError(
        "Cannot persist the immutable handoff evaluation. Check workspace permissions and retry.",
        { cause: error },
      );
    }
  }
}
