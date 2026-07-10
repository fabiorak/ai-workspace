export type WorkItemId = string & { readonly __brand: "WorkItemId" };

export type RepositoryType = "SOFTWARE" | "DOCUMENTS" | "MIXED";

export type WorkItemStatus = "PROPOSED" | "ACTIVE" | "BLOCKED" | "COMPLETED";

export type WorkItem = Readonly<{
  id: WorkItemId;
  objective: string;
  projectId: string;
  status: WorkItemStatus;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateWorkItemInput = Readonly<{
  id: string;
  objective: string;
  projectId: string;
  now?: Date;
}>;

export class DomainValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export function createWorkItem(input: CreateWorkItemInput): WorkItem {
  const id = requiredText(input.id, "Work item id") as WorkItemId;
  const objective = requiredText(input.objective, "Work item objective");
  const projectId = requiredText(input.projectId, "Project id");
  const timestamp = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id,
    objective,
    projectId,
    status: "PROPOSED",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError(`${field} must not be empty`);
  }

  return normalized;
}
