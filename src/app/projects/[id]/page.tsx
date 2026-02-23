/**
 * ==========================================================
 * PROJECT DETAIL PAGE (SERVER COMPONENT)
 * ----------------------------------------------------------
 * URL: /projects/:id
 * Example: /projects/1
 *
 * What this file does:
 * - Runs on the server
 * - Checks for HttpOnly cookie "pelios_token"
 * - If missing → redirect to /login (no flashing)
 * - If present → render the client UI component
 * ==========================================================
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProjectClient from "./ProjectClient";

type Props = {
  params: { id: string };
};

export default async function ProjectPage({ params }: Props) {
  // ✅ Auth guard on the server
  const token = (await cookies()).get("pelios_token")?.value;

  if (!token) {
    redirect("/login");
  }

  // ✅ pass the route param down to the client component
  return <ProjectClient sourceId={params.id} />;
}