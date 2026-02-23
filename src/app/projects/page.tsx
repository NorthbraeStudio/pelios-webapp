/**
 * ==========================================================
 * PROJECTS PAGE (SERVER COMPONENT)
 * ----------------------------------------------------------
 * Purpose:
 * - Runs on the server.
 * - Checks for the HttpOnly auth cookie.
 * - Redirects to /login if user is not authenticated.
 * - Only renders the client UI if auth is valid.
 *
 * Why this exists:
 * - Prevents page render when logged out.
 * - Avoids 401 flashes.
 * - More stable than middleware for MVP.
 * ==========================================================
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProjectsClient from "./ProjectsClient";

export default async function ProjectsPage() {
  // Read secure HttpOnly cookie set during login
  const cookieStore = await cookies();
  const token = cookieStore.get("pelios_token")?.value;

  // If no token → user is not authenticated
  if (!token) {
    redirect("/login");
  }

  // If authenticated → render client UI
  return <ProjectsClient />;
}