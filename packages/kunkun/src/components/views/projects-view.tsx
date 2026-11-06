import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { FolderGit2 } from "lucide-react";

export function ProjectsView() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            Projects & Activity
          </h2>
          <Badge variant="outline">Opt-in Beta</Badge>
        </div>
        <p className="text-xs text-zinc-400">
          Correlate local AI tool consumption with workspace activity without exposing paths or
          code.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-2 text-xs text-zinc-300">
        <div className="font-semibold text-zinc-100">Privacy Guarantee</div>
        <p className="text-zinc-400">
          Project paths, repository names, and prompt contents remain strictly on this Mac. Activity
          analysis is computed locally and never uploaded to any remote telemetry pool.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Local Workspace Allocation</CardTitle>
          <CardDescription>Estimated quota share by local repository</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs py-2 border-b border-zinc-800">
            <div className="flex items-center space-x-2">
              <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-zinc-200">kuota</span>
            </div>
            <span className="text-zinc-400">48% of cycle consumption</span>
          </div>
          <div className="flex items-center justify-between text-xs py-2 border-b border-zinc-800">
            <div className="flex items-center space-x-2">
              <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono text-zinc-200">kunkun</span>
            </div>
            <span className="text-zinc-400">32% of cycle consumption</span>
          </div>
          <div className="flex items-center justify-between text-xs py-2">
            <div className="flex items-center space-x-2">
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-mono text-zinc-200">other projects</span>
            </div>
            <span className="text-zinc-400">20% of cycle consumption</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
