import { describe, expect, it } from "vitest";
import { loginPatient, registerPatient } from "../src/auth/patient-auth.js";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
} as NodeJS.ProcessEnv;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("patient auth", () => {
  it("creates a confirmed patient and signs them in", async () => {
    const calls: string[] = [];
    const session = await registerPatient(env, {
      full_name: "Amina Rahman",
      phone: "+91 98765 43210",
      email: "amina@example.com",
      password: "password1",
    }, async (input, init) => {
      const url = String(input);
      calls.push(url);
      const body = JSON.parse(String(init?.body));
      if (url.endsWith("/auth/v1/admin/users")) {
        expect(body.user_metadata).toEqual({ full_name: "Amina Rahman", phone: "+91 98765 43210" });
        expect(body.email_confirm).toBe(true);
        return jsonResponse(200, { id: "user-1" });
      }
      return jsonResponse(200, {
        access_token: "access-1",
        refresh_token: "refresh-1",
        user: { user_metadata: { full_name: "Amina Rahman", phone: "+91 98765 43210" } },
      });
    });
    expect(calls).toHaveLength(2);
    expect(session.email).toBe("amina@example.com");
    expect(session.full_name).toBe("Amina Rahman");
    expect(session.access_token).toBe("access-1");
  });

  it("explains a database failure instead of hiding it", async () => {
    await expect(registerPatient(env, {
      full_name: "Amina Rahman",
      phone: "+919876543210",
      email: "amina@example.com",
      password: "password1",
    }, async () => jsonResponse(500, { message: "Database error saving new user" }))).rejects.toMatchObject({
      message: "The account could not be saved. Apply the database migrations on the Supabase project, then register again.",
    });
  });
  it("rejects a wrong password without exposing the provider message", async () => {
    await expect(loginPatient(env, { email: "amina@example.com", password: "password1" }, async () => {
      return jsonResponse(400, { error_description: "Invalid login credentials", error: "invalid_grant" });
    })).rejects.toMatchObject({ status: 401, message: "Email or password is incorrect." });
  });
});
