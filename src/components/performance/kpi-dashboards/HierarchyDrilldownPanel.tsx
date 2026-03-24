import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Network, FolderTree } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CROSSREF_FIELDS } from '@/hooks/useHierarchyKPI';

interface Props {
  selectedProject: any | null;
  hierarchy: { wbs: any[]; activities: any[]; tasks: any[]; resources: any[] } | null;
  loading: boolean;
}

const FIELDS = {
  projectName: 'b1000001-0002-0000-0000-000000000001',
  wbsName: 'b2000001-0004-0000-0000-000000000001',
  wbsStatus: 'b2000001-0011-0000-0000-000000000001',
  activityName: 'b3000001-0003-0000-0000-000000000001',
  activityStatus: 'b3000001-0010-0000-0000-000000000001',
  taskName: 'b4000001-0003-0000-0000-000000000001',
  taskStatus: 'b4000001-0005-0000-0000-000000000001',
  resourceName: 'b5000001-0004-0000-0000-000000000001',
  plannedHours: 'b5000001-0008-0000-0000-000000000001',
  actualHours: 'b5000001-0009-0000-0000-000000000001',
};

function asText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null) {
    if ('label' in value) return String(value.label || '');
    if ('value' in value) return String(value.value || '');
  }
  return String(value);
}

function asNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) {
    if ('amount' in value) return Number(value.amount) || 0;
    if ('value' in value) return Number(value.value) || 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function extractRefIds(crossRefValue: any): string[] {
  if (!crossRefValue) return [];
  if (Array.isArray(crossRefValue)) {
    return crossRefValue
      .map((item: any) => item?.submission_ref_id || (typeof item === 'string' ? item : null))
      .filter(Boolean);
  }
  if (typeof crossRefValue === 'string') {
    return crossRefValue.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function HierarchyDrilldownPanel({ selectedProject, hierarchy, loading }: Props) {
  const activitiesByRef = useMemo(
    () => new Map((hierarchy?.activities || []).map((item) => [item.submission_ref_id, item])),
    [hierarchy?.activities]
  );
  const tasksByRef = useMemo(
    () => new Map((hierarchy?.tasks || []).map((item) => [item.submission_ref_id, item])),
    [hierarchy?.tasks]
  );
  const resourcesByRef = useMemo(
    () => new Map((hierarchy?.resources || []).map((item) => [item.submission_ref_id, item])),
    [hierarchy?.resources]
  );

  if (!selectedProject) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Select a specific Project above to open the hierarchy drill-down tree.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading linked hierarchy...
        </CardContent>
      </Card>
    );
  }

  if (!hierarchy || hierarchy.wbs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No linked WBS records found for this project. Add cross-reference links in the Project record to enable drill-down.
        </CardContent>
      </Card>
    );
  }

  const projectData = selectedProject.submission_data || {};
  const projectLabel = asText(projectData[FIELDS.projectName]) || selectedProject.submission_ref_id || selectedProject.id?.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Hierarchy Drill-Down
            </CardTitle>
            <CardDescription>
              {projectLabel} • click WBS and Activities to drill down to Tasks and Resources.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline">{hierarchy.wbs.length} WBS</Badge>
            <Badge variant="outline">{hierarchy.activities.length} Activities</Badge>
            <Badge variant="outline">{hierarchy.tasks.length} Tasks</Badge>
            <Badge variant="outline">{hierarchy.resources.length} Resources</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {hierarchy.wbs.map((wbs) => {
            const wbsData = wbs.submission_data || {};
            const activityRefs = extractRefIds(wbsData[CROSSREF_FIELDS.WBS_TO_ACTIVITIES]);
            const linkedActivities = activityRefs.map((ref) => activitiesByRef.get(ref)).filter(Boolean) as any[];

            return (
              <AccordionItem key={wbs.id} value={`wbs-${wbs.id}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-2 pr-2">
                    <div className="text-left">
                      <p className="font-medium text-foreground">
                        {wbs.submission_ref_id} — {asText(wbsData[FIELDS.wbsName]) || 'WBS Item'}
                      </p>
                      <p className="text-xs text-muted-foreground">{linkedActivities.length} linked activities</p>
                    </div>
                    <Badge variant="outline">{asText(wbsData[FIELDS.wbsStatus]) || 'Unknown'}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {linkedActivities.length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      No activities linked to this WBS.
                    </div>
                  )}

                  <Accordion type="multiple" className="w-full pl-2">
                    {linkedActivities.map((activity) => {
                      const activityData = activity.submission_data || {};
                      const taskRefs = extractRefIds(activityData[CROSSREF_FIELDS.ACTIVITY_TO_TASKS]);
                      const linkedTasks = taskRefs.map((ref) => tasksByRef.get(ref)).filter(Boolean) as any[];

                      return (
                        <AccordionItem key={activity.id} value={`activity-${activity.id}`} className="rounded-md border px-3">
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex w-full items-center justify-between gap-2 pr-2">
                              <div className="text-left">
                                <p className="text-sm font-medium text-foreground">
                                  {activity.submission_ref_id} — {asText(activityData[FIELDS.activityName]) || 'Activity'}
                                </p>
                                <p className="text-xs text-muted-foreground">{linkedTasks.length} linked tasks</p>
                              </div>
                              <Badge variant="secondary">{asText(activityData[FIELDS.activityStatus]) || 'Unknown'}</Badge>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="space-y-2 pb-3">
                            {linkedTasks.length === 0 && (
                              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                No tasks linked to this activity.
                              </div>
                            )}

                            {linkedTasks.map((task) => {
                              const taskData = task.submission_data || {};
                              const resourceRefs = extractRefIds(taskData[CROSSREF_FIELDS.TASK_TO_RESOURCES]);
                              const linkedResources = resourceRefs.map((ref) => resourcesByRef.get(ref)).filter(Boolean) as any[];

                              return (
                                <div key={task.id} className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {task.submission_ref_id} — {asText(taskData[FIELDS.taskName]) || 'Task'}
                                    </p>
                                    <Badge variant="outline">{asText(taskData[FIELDS.taskStatus]) || 'Unknown'}</Badge>
                                  </div>

                                  {linkedResources.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No resources linked to this task.</p>
                                  ) : (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <FolderTree className="h-3 w-3" />
                                        Linked Resources
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {linkedResources.map((resource) => {
                                          const resourceData = resource.submission_data || {};
                                          const planned = asNumber(resourceData[FIELDS.plannedHours]);
                                          const actual = asNumber(resourceData[FIELDS.actualHours]);
                                          return (
                                            <Badge key={resource.id} variant="secondary" className="font-normal">
                                              {resource.submission_ref_id} • {asText(resourceData[FIELDS.resourceName]) || 'Resource'} ({actual.toFixed(0)}/{planned.toFixed(0)}h)
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
