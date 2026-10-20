import { verifySession } from "@/lib/dal";
import { env } from "@/env";
import { listRepos } from "@/server/repos";
import { ProjectsView } from "./projects-view";

export default async function ProjectsPage() {
  const { user } = await verifySession();
  return <ProjectsView repos={await listRepos(user.id)} installUrl={`https://github.com/apps/${env().GITHUB_APP_SLUG}/installations/new`} login={user.name} />;
}
