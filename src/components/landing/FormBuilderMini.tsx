import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, MousePointer2, Boxes, Workflow } from "lucide-react";

export default function FormBuilderMini() {
  return (
    <section aria-labelledby="builder-mini-heading" className="container mx-auto px-4">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle id="builder-mini-heading">Drag-and-drop form builder</CardTitle>
          <CardDescription>Fields, validations, and conditional logic in minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 bg-muted/40">
              <div className="flex items-center gap-2 mb-2"><Boxes className="h-4 w-4 text-primary"/><span className="font-medium">Field palette</span></div>
              <div className="flex flex-wrap gap-2">
                {["Text", "Email", "Number", "Date", "Select", "File"].map((f) => (
                  <Badge key={f} variant="secondary">{f}</Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4 col-span-2">
              <div className="text-sm text-muted-foreground mb-3">Canvas (sample)</div>
              <div className="space-y-3">
                <div className="rounded-md border bg-background p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Full Name</div>
                    <div className="text-xs text-muted-foreground">Text • required</div>
                  </div>
                  <MousePointer2 className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-md border bg-background p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-xs text-muted-foreground">Email • required</div>
                  </div>
                  <MousePointer2 className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-md border bg-background p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Department</div>
                    <div className="text-xs text-muted-foreground">Select • shows extra fields when "Support"</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
