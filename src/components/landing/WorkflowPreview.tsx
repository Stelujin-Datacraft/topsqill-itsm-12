import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle, Clock, Mail, FileText } from "lucide-react";

export default function WorkflowPreview() {
  return (
    <section aria-labelledby="workflow-preview-heading" className="container mx-auto px-4">
      <Card>
        <CardHeader>
          <CardTitle id="workflow-preview-heading">Visual workflow automation</CardTitle>
          <CardDescription>Connect forms to automated actions, approvals, and notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="font-medium">Form Submit</div>
              <Badge variant="secondary" className="mt-1">Trigger</Badge>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
                <Clock className="h-8 w-8 text-secondary" />
              </div>
              <div className="font-medium">Manager Review</div>
              <Badge variant="outline" className="mt-1">Action</Badge>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-4 mt-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="font-medium">Auto Approve</div>
              <Badge variant="secondary" className="mt-1">Condition</Badge>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <div className="font-medium">Send Email</div>
              <Badge variant="outline" className="mt-1">Notification</Badge>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              + Database update<br />+ Slack notification<br />+ File generation
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}