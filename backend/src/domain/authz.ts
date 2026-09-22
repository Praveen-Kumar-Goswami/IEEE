export type Role = "patient" | "doctor" | "nurse" | "admin";

export type Actor = {
  id: string;
  role: Role;
  fullName: string;
};

export type Access =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 404;
      code: "unauthorized" | "forbidden" | "not_found";
      message: string;
    };

const denied: Access = {
  ok: false,
  status: 403,
  code: "forbidden",
  message: "You do not have access to this resource.",
};

export function requireActor(actor: Actor | null): Access {
  if (!actor) {
    return { ok: false, status: 401, code: "unauthorized", message: "Sign in is required." };
  }
  return { ok: true };
}

export function isClinician(actor: Actor): boolean {
  return actor.role === "doctor" || actor.role === "nurse";
}

export function canSync(actor: Actor, patientId: string): Access {
  const signedIn = requireActor(actor);
  if (!signedIn.ok) return signedIn;
  if (actor.role !== "patient" || actor.id !== patientId) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "Monitoring session not found.",
    };
  }
  return { ok: true };
}

export function canAccessPatient(actor: Actor, patientId: string, assigned: boolean): Access {
  const signedIn = requireActor(actor);
  if (!signedIn.ok) return signedIn;
  if (actor.role === "admin") return { ok: true };
  if (actor.role === "patient") return actor.id === patientId ? { ok: true } : denied;
  if (!isClinician(actor) || !assigned) return denied;
  return { ok: true };
}

export function canAcknowledge(actor: Actor, assigned: boolean): Access {
  const signedIn = requireActor(actor);
  if (!signedIn.ok) return signedIn;
  if (actor.role === "patient") return denied;
  if (actor.role === "admin") return { ok: true };
  if (!isClinician(actor) || !assigned) return denied;
  return { ok: true };
}

export function canWriteNote(actor: Actor, assigned: boolean): Access {
  return canAcknowledge(actor, assigned);
}

export function requireAdmin(actor: Actor): Access {
  const signedIn = requireActor(actor);
  if (!signedIn.ok) return signedIn;
  if (actor.role !== "admin") return denied;
  return { ok: true };
}

export function requireClinicianReader(actor: Actor): Access {
  const signedIn = requireActor(actor);
  if (!signedIn.ok) return signedIn;
  if (actor.role === "admin" || isClinician(actor)) return { ok: true };
  return denied;
}
